import fixture from "./__fixtures__/vault-fixture.json";
import { fromBase64 } from "./base64";
import { CryptoError } from "./errors";
import { unlockWithPassword } from "./wharfv";
import { openWithDek, unlockVaultWithDek } from "./wharfv-dek";

// Proves the mobile cached-DEK path is consistent with the password path: unlock
// the Go-created fixture with the password to obtain the DEK, then re-open the
// SAME blob with only that DEK via openWithDek — the two must yield byte-for-byte
// the same payload. This is the exact sequence the biometric unlock relies on
// (password unlock once → cache DEK → later opens use openWithDek).
describe("openWithDek", () => {
  const blob = fromBase64(fixture.vaultBase64);
  const expectedPayload = new TextEncoder().encode(fixture.payloadUtf8);

  it("opens the body with a DEK from a prior password unlock", async () => {
    const unlocked = await unlockWithPassword(blob, fixture.password);
    const payload = await openWithDek(blob, unlocked.dek);
    expect(payload).toEqual(expectedPayload);
    expect(payload).toEqual(unlocked.payload);
  }, 30_000);

  it("rejects a wrong DEK with a wrong-secret error", async () => {
    const wrongDek = new Uint8Array(32).fill(7);
    await expect(openWithDek(blob, wrongDek)).rejects.toBeInstanceOf(CryptoError);
    await expect(openWithDek(blob, wrongDek)).rejects.toMatchObject({ code: "wrong-secret" });
  }, 30_000);

  it("rejects a structurally short blob as corrupt", async () => {
    await expect(openWithDek(blob.slice(0, 100), new Uint8Array(32))).rejects.toMatchObject({
      code: "corrupt",
    });
  });

  it("unlockVaultWithDek reconstructs the full unlocked session (params + header)", async () => {
    const unlocked = await unlockWithPassword(blob, fixture.password);
    const viaDek = await unlockVaultWithDek(blob, unlocked.dek);
    expect(viaDek.payload).toEqual(unlocked.payload);
    expect(viaDek.dek).toEqual(unlocked.dek);
    // A copy, not the same buffer — locking one session must not wipe the other.
    expect(viaDek.dek).not.toBe(unlocked.dek);
    expect(viaDek.header).toEqual(unlocked.header);
    // Fixture was created with the Go DefaultParams (t=3, m=64 MiB, p=4).
    expect(viaDek.params).toEqual({ iterations: 3, memoryKiB: 64 * 1024, parallelism: 4 });
  }, 30_000);
});
