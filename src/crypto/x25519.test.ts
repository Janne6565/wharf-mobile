import { randomBytes } from "./primitives";
import { generateKeypair, openDek, sealDek, WRAPPED_DEK_LEN } from "./x25519";

function makeDek(): Uint8Array {
  return randomBytes(32);
}

describe("X25519 sealed-box DEK wrapping", () => {
  it("round-trips seal -> open with the recipient keypair", async () => {
    const { publicKey, privateKey } = await generateKeypair();
    const dek = makeDek();
    const wrapped = await sealDek(dek, publicKey);
    expect(wrapped.length).toBe(WRAPPED_DEK_LEN);
    expect(WRAPPED_DEK_LEN).toBe(80);
    const opened = await openDek(wrapped, publicKey, privateKey);
    expect(opened).toEqual(dek);
  });

  it("produces a fresh ephemeral key per seal", async () => {
    const { publicKey } = await generateKeypair();
    const dek = makeDek();
    const a = await sealDek(dek, publicKey);
    const b = await sealDek(dek, publicKey);
    expect(a).not.toEqual(b);
  });

  it("rejects the wrong recipient with a wrong-secret error", async () => {
    const recipient = await generateKeypair();
    const other = await generateKeypair();
    const wrapped = await sealDek(makeDek(), recipient.publicKey);
    await expect(openDek(wrapped, other.publicKey, other.privateKey)).rejects.toMatchObject({
      code: "wrong-secret",
    });
  });

  it("rejects malformed inputs as corrupt", async () => {
    const { publicKey, privateKey } = await generateKeypair();
    await expect(sealDek(randomBytes(31), publicKey)).rejects.toMatchObject({ code: "corrupt" });
    await expect(sealDek(makeDek(), randomBytes(31))).rejects.toMatchObject({ code: "corrupt" });
    await expect(openDek(randomBytes(79), publicKey, privateKey)).rejects.toMatchObject({
      code: "corrupt",
    });
  });
});
