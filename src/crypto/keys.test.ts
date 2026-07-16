import { toBase64 } from "./base64";
import { deriveAuthKey, deriveMasterKey, deriveRecoveryAuthKey, normalizeEmail } from "./keys";

describe("key derivation", () => {
  it("normalizes email (trim + lowercase)", () => {
    expect(normalizeEmail("  Deniz@ACME.io ")).toBe("deniz@acme.io");
  });

  it("derives the same master key regardless of email casing/whitespace", async () => {
    const a = await deriveMasterKey("hunter2", "deniz@acme.io");
    const b = await deriveMasterKey("hunter2", "  Deniz@ACME.io ");
    expect(a).toEqual(b);
  });

  it("derives a different master key for a different password", async () => {
    const a = await deriveMasterKey("hunter2", "deniz@acme.io");
    const b = await deriveMasterKey("hunter3", "deniz@acme.io");
    expect(a).not.toEqual(b);
  });

  it("produces base64 keys of 32 bytes (44 chars)", async () => {
    const mk = await deriveMasterKey("hunter2", "deniz@acme.io");
    const authKey = await deriveAuthKey(mk);
    expect(authKey).toHaveLength(44);
  });

  // Known-answer vectors: a stable regression guard on the full derivation
  // pipeline (argon2id p=4 + HKDF-SHA256). If any parameter or step changes,
  // these break.
  it("matches pinned known-answer vectors", async () => {
    const mk = await deriveMasterKey("hunter2", "  Deniz@ACME.io ");
    expect(toBase64(mk)).toBe("4whxiRmv/Go698JZxXM4WFdFVT68bs3LHUVkmL0+A8M=");
    expect(await deriveAuthKey(mk)).toBe("nnzMcXPLofscNtfrXSFz0S7zt0yd1mkTzy0Gw7JWXH8=");

    const secret = Uint8Array.from({ length: 25 }, (_, i) => (i * 7 + 3) & 0xff);
    expect(await deriveRecoveryAuthKey(secret)).toBe(
      "hmzd1iB3GK6Lw2OJlEG+D45nOZmKXthOiXHo4MqnzX0=",
    );
  }, 30_000);

  it("auth and recovery keys differ for the same input bytes", async () => {
    const bytes = new Uint8Array(32).fill(9);
    const authKey = await deriveAuthKey(bytes);
    const recoveryKey = await deriveRecoveryAuthKey(bytes);
    expect(authKey).not.toBe(recoveryKey);
  });
});
