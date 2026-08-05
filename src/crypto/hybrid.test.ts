import {
  encodeIdentity,
  HYBRID_PRIV_LEN,
  HYBRID_PUB_LEN,
  HYBRID_WRAPPED_DEK_LEN,
  isHybridPub,
  isIdentityPub,
  newMlkemSeed,
} from "./hybrid";
import { randomBytes } from "./primitives";
import { generateKeypair, openDek, sealDek, WRAPPED_DEK_LEN } from "./x25519";

async function hybridIdentity() {
  const kp = await generateKeypair();
  const seed = newMlkemSeed();
  return { ...encodeIdentity(kp.publicKey, kp.privateKey, seed), x25519: kp, seed };
}

describe("hybrid identity encoding", () => {
  it("produces the documented sizes", async () => {
    const id = await hybridIdentity();
    expect(id.publicKey.length).toBe(HYBRID_PUB_LEN);
    expect(id.privateKey.length).toBe(HYBRID_PRIV_LEN);
    expect(isHybridPub(id.publicKey)).toBe(true);
    expect(isIdentityPub(id.publicKey)).toBe(true);
  });

  it("keeps the X25519 keypair, so pre-upgrade DEKs still open", async () => {
    const kp = await generateKeypair();
    const dek = randomBytes(32);
    const classical = await sealDek(dek, kp.publicKey);
    expect(classical.length).toBe(WRAPPED_DEK_LEN);

    const upgraded = encodeIdentity(kp.publicKey, kp.privateKey, newMlkemSeed());
    expect(await openDek(classical, upgraded.publicKey, upgraded.privateKey)).toEqual(dek);
  });

  it("without a seed encodes the v1 forms unchanged", async () => {
    const kp = await generateKeypair();
    const encoded = encodeIdentity(kp.publicKey, kp.privateKey);
    expect(encoded.publicKey).toEqual(kp.publicKey);
    expect(encoded.privateKey).toEqual(kp.privateKey);
    expect(isIdentityPub(encoded.publicKey)).toBe(true);
    expect(isHybridPub(encoded.publicKey)).toBe(false);
  });
});

describe("hybrid DEK wrapping", () => {
  it("round-trips a DEK", async () => {
    const id = await hybridIdentity();
    const dek = randomBytes(32);
    const wrapped = await sealDek(dek, id.publicKey);
    expect(wrapped.length).toBe(HYBRID_WRAPPED_DEK_LEN);
    expect(await openDek(wrapped, id.publicKey, id.privateKey)).toEqual(dek);
  });

  it("follows the recipient's version, not a local preference", async () => {
    // An upgraded client must still be able to key a member who has not
    // upgraded — otherwise the migration strands them.
    const classicalRecipient = await generateKeypair();
    const dek = randomBytes(32);
    const wrapped = await sealDek(dek, classicalRecipient.publicKey);
    expect(wrapped.length).toBe(WRAPPED_DEK_LEN);
    expect(
      await openDek(wrapped, classicalRecipient.publicKey, classicalRecipient.privateKey),
    ).toEqual(dek);
  });

  it("needs both halves: neither the X25519 nor the ML-KEM key alone opens it", async () => {
    const id = await hybridIdentity();
    const dek = randomBytes(32);
    const wrapped = await sealDek(dek, id.publicKey);

    // X25519 half alone.
    await expect(openDek(wrapped, id.x25519.publicKey, id.x25519.privateKey)).rejects.toThrow();

    // ML-KEM half alone: the real seed, but a foreign X25519 key.
    const other = await generateKeypair();
    const forged = encodeIdentity(other.publicKey, other.privateKey, id.seed);
    await expect(openDek(wrapped, forged.publicKey, forged.privateKey)).rejects.toThrow();
  });

  it("rejects tampering anywhere in the blob", async () => {
    const id = await hybridIdentity();
    const wrapped = await sealDek(randomBytes(32), id.publicKey);
    for (const at of [0, 1, 1 + 1088, HYBRID_WRAPPED_DEK_LEN - 1]) {
      const bad = wrapped.slice();
      bad[at] ^= 0xff;
      await expect(openDek(bad, id.publicKey, id.privateKey)).rejects.toThrow();
    }
  });
});
