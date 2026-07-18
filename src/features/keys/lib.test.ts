import { toBase64 } from "@/crypto";
import { identityFingerprint, sshFingerprint } from "./lib";

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

describe("sshFingerprint", () => {
  // Fixed vector produced locally via `ssh-keygen -lf` on a fresh ed25519 key —
  // proves byte-parity with what OpenSSH (and the TUI) shows.
  const LINE =
    "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFAC5/HFXwgTZfFm6BWroF68v0V4V4ywkb1xFf/5Fr0g wharf-test@example";
  const EXPECTED = "SHA256:LuRnyOyNpWKBUpnUVpqlIW1G7wTYFY3nGfiRouwFln4";

  it("matches the ssh-keygen SHA256 fingerprint for a known key", () => {
    expect(sshFingerprint(LINE)).toBe(EXPECTED);
  });

  it("ignores a missing comment field", () => {
    const [type, blob] = LINE.split(/\s+/);
    expect(sshFingerprint(`${type} ${blob}`)).toBe(EXPECTED);
  });

  it("returns '' for an empty or blob-less line", () => {
    expect(sshFingerprint("")).toBe("");
    expect(sshFingerprint("ssh-ed25519")).toBe("");
  });

  it("returns '' when the blob is not valid base64", () => {
    expect(sshFingerprint("ssh-ed25519 !!!notbase64!!!")).toBe("");
  });
});
