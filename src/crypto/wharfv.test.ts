import { CryptoError } from "./errors";
import type { Argon2Params } from "./primitives";
import {
  createVault,
  HEADER_LEN,
  reEncrypt,
  sealPayload,
  unlockWithPassword,
  unlockWithRecovery,
} from "./wharfv";

// Tiny argon2 cost keeps the round-trip suite fast; the byte-compat fixture
// test exercises the real DefaultParams (t=3, m=64MiB, p=4).
const fastParams: Argon2Params = { iterations: 1, memoryKiB: 8192, parallelism: 1 };

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function makePayload(text: string): Uint8Array {
  return encoder.encode(text);
}

describe("WHARFV vault", () => {
  it("creates a blob with the WHARFV magic and 218-byte header", async () => {
    const { blob } = await createVault("hunter2", makePayload("{}"), fastParams);
    expect(decoder.decode(blob.subarray(0, 6))).toBe("WHARFV");
    expect(blob.length).toBeGreaterThan(HEADER_LEN);
  });

  it("round-trips create -> unlock via password", async () => {
    const payload = makePayload('{"hosts":["a","b"]}');
    const { blob } = await createVault("hunter2", payload, fastParams);
    const unlocked = await unlockWithPassword(blob, "hunter2");
    expect(unlocked.payload).toEqual(payload);
  });

  it("round-trips create -> unlock via recovery code", async () => {
    const payload = makePayload("payload");
    const { blob, recoveryCode } = await createVault("hunter2", payload, fastParams);
    // Recovery accepts a messy, grouped, lower-cased code.
    const messy = `${recoveryCode.slice(0, 5)}-${recoveryCode.slice(5)}`.toLowerCase();
    const unlocked = await unlockWithRecovery(blob, messy);
    expect(unlocked.payload).toEqual(payload);
  });

  it("rejects the wrong password with a wrong-secret error", async () => {
    const { blob } = await createVault("hunter2", makePayload("{}"), fastParams);
    await expect(unlockWithPassword(blob, "wrong")).rejects.toMatchObject({
      code: "wrong-secret",
    });
  });

  it("detects tampering (flipped byte) as corrupt or wrong-secret", async () => {
    const { blob } = await createVault("hunter2", makePayload("secret data"), fastParams);
    // Flip a byte inside the sealed body (after the header).
    const tampered = blob.slice();
    tampered[blob.length - 1] ^= 0xff;
    await expect(unlockWithPassword(tampered, "hunter2")).rejects.toBeInstanceOf(CryptoError);
  });

  it("detects a corrupted header (bad magic) as corrupt", async () => {
    const { blob } = await createVault("hunter2", makePayload("{}"), fastParams);
    const tampered = blob.slice();
    tampered[0] ^= 0xff;
    await expect(unlockWithPassword(tampered, "hunter2")).rejects.toMatchObject({
      code: "corrupt",
    });
  });

  describe("sealPayload (re-seal same slots)", () => {
    it("updates the payload while the same password and recovery code still unlock", async () => {
      const original = makePayload('{"schema":1,"hosts":[]}');
      const created = await createVault("hunter2", original, fastParams);
      const unlocked = await unlockWithPassword(created.blob, "hunter2");

      const updated = makePayload('{"schema":2,"hosts":[],"identity":{"x25519Pub":"AA=="}}');
      const newBlob = await sealPayload(unlocked, updated);

      // The unchanged password unlocks the re-sealed blob and yields the new payload.
      const viaPassword = await unlockWithPassword(newBlob, "hunter2");
      expect(viaPassword.payload).toEqual(updated);

      // The original recovery code still unlocks it too (slots untouched).
      const viaRecovery = await unlockWithRecovery(newBlob, created.recoveryCode);
      expect(viaRecovery.payload).toEqual(updated);

      // The wrapped-DEK slots are byte-identical; only the body changed.
      expect(newBlob.slice(0, HEADER_LEN - 24)).toEqual(created.blob.slice(0, HEADER_LEN - 24));
    });

    it("draws a fresh body nonce so two re-seals differ", async () => {
      const created = await createVault("pw", makePayload("{}"), fastParams);
      const unlocked = await unlockWithPassword(created.blob, "pw");
      const a = await sealPayload(unlocked, makePayload('{"a":1}'));
      const b = await sealPayload(unlocked, makePayload('{"a":1}'));
      expect(a).not.toEqual(b);
    });
  });

  describe("reEncrypt (password reset)", () => {
    it("keeps the payload, rotates the recovery code, invalidates old secrets", async () => {
      const payload = makePayload('{"k":"v"}');
      const created = await createVault("oldpass", payload, fastParams);
      const unlocked = await unlockWithRecovery(created.blob, created.recoveryCode);

      const reset = await reEncrypt(unlocked, "newpass");
      expect(reset.recoveryCode).not.toBe(created.recoveryCode);

      // New password unlocks and preserves the payload.
      const viaNew = await unlockWithPassword(reset.blob, "newpass");
      expect(viaNew.payload).toEqual(payload);

      // New recovery code unlocks.
      const viaNewRec = await unlockWithRecovery(reset.blob, reset.recoveryCode);
      expect(viaNewRec.payload).toEqual(payload);

      // Old password and old recovery code no longer work on the new blob.
      await expect(unlockWithPassword(reset.blob, "oldpass")).rejects.toMatchObject({
        code: "wrong-secret",
      });
      await expect(unlockWithRecovery(reset.blob, created.recoveryCode)).rejects.toMatchObject({
        code: "wrong-secret",
      });
    });
  });
});
