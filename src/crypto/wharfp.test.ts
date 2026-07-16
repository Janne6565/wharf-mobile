import { CryptoError } from "./errors";
import { randomBytes } from "./primitives";
import { HEADER_LEN, openProject, sealProject } from "./wharfp";

const decoder = new TextDecoder();
const encoder = new TextEncoder();

function makeDek(): Uint8Array {
  return randomBytes(32);
}

describe("WHARFP project blob", () => {
  it("seals a blob with the WHARFP magic, version 1, and 32-byte header", async () => {
    const blob = await sealProject(makeDek(), encoder.encode("{}"));
    expect(decoder.decode(blob.subarray(0, 6))).toBe("WHARFP");
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    expect(view.getUint16(6, true)).toBe(1);
    expect(HEADER_LEN).toBe(32);
    expect(blob.length).toBeGreaterThan(HEADER_LEN);
  });

  it("round-trips seal -> open under the same DEK", async () => {
    const dek = makeDek();
    const payload = encoder.encode('{"schema":1,"hosts":[{"id":"abc","name":"prod"}]}');
    const blob = await sealProject(dek, payload);
    const opened = await openProject(dek, blob);
    expect(opened).toEqual(payload);
  });

  it("draws a fresh nonce per seal (no blob is ever identical)", async () => {
    const dek = makeDek();
    const payload = encoder.encode("same payload");
    const a = await sealProject(dek, payload);
    const b = await sealProject(dek, payload);
    expect(a).not.toEqual(b);
  });

  it("rejects the wrong DEK as corrupt", async () => {
    const blob = await sealProject(makeDek(), encoder.encode("secret"));
    await expect(openProject(makeDek(), blob)).rejects.toMatchObject({ code: "corrupt" });
  });

  it("detects a flipped ciphertext byte as corrupt", async () => {
    const dek = makeDek();
    const blob = await sealProject(dek, encoder.encode("secret payload"));
    const tampered = blob.slice();
    tampered[tampered.length - 1] ^= 0xff;
    await expect(openProject(dek, tampered)).rejects.toBeInstanceOf(CryptoError);
  });

  it("detects a flipped header (AAD) byte as corrupt", async () => {
    const dek = makeDek();
    const blob = await sealProject(dek, encoder.encode("secret payload"));
    const tampered = blob.slice();
    tampered[8] ^= 0xff; // inside the AAD-covered body nonce
    await expect(openProject(dek, tampered)).rejects.toMatchObject({ code: "corrupt" });
  });

  it("rejects bad magic, bad version, and truncation as corrupt", async () => {
    const dek = makeDek();
    const blob = await sealProject(dek, encoder.encode("payload"));

    const badMagic = blob.slice();
    badMagic[0] ^= 0xff;
    await expect(openProject(dek, badMagic)).rejects.toMatchObject({ code: "corrupt" });

    const badVersion = blob.slice();
    new DataView(badVersion.buffer).setUint16(6, 2, true);
    await expect(openProject(dek, badVersion)).rejects.toMatchObject({ code: "corrupt" });

    await expect(openProject(dek, blob.slice(0, HEADER_LEN - 1))).rejects.toMatchObject({
      code: "corrupt",
    });
  });
});
