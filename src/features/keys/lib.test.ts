import { toBase64 } from "@/crypto";
import { identityFingerprint } from "./lib";

describe("identityFingerprint", () => {
  const keyA = toBase64(new Uint8Array(32).fill(1));
  const keyB = toBase64(new Uint8Array(32).fill(2));

  it("formats as eight colon-grouped hex byte pairs", () => {
    // 8 bytes → 16 hex chars in 8 pairs joined by 7 colons = 23 chars.
    const fp = identityFingerprint(keyA);
    expect(fp).toMatch(/^([0-9a-f]{2}:){7}[0-9a-f]{2}$/);
  });

  it("is deterministic for the same key and differs for a different key", () => {
    expect(identityFingerprint(keyA)).toBe(identityFingerprint(keyA));
    expect(identityFingerprint(keyA)).not.toBe(identityFingerprint(keyB));
  });

  it("returns an empty string for input that does not decode", () => {
    expect(identityFingerprint("!!!not base64!!!")).toBe("");
  });
});
