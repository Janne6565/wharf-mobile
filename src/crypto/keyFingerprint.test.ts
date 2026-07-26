import { publicKeyFingerprint } from "./keyFingerprint";

// Golden vectors shared with wharf-web and the TUI. The fingerprint is what a
// user compares across devices, so a change to any of these is a protocol break,
// not a cosmetic one.
describe("publicKeyFingerprint", () => {
  it("matches the shared vector for 32 zero bytes", () => {
    expect(publicKeyFingerprint(new Uint8Array(32))).toBe("Zmh6 rfhi vXds j8GL");
  });

  it("matches the shared vector for 32 0x01 bytes", () => {
    expect(publicKeyFingerprint(new Uint8Array(32).fill(1))).toBe("cs1u hCLE B/tt CYaQ");
  });

  it("matches the shared vector for 0x00..0x1f ascending", () => {
    const key = Uint8Array.from({ length: 32 }, (_, i) => i);
    expect(publicKeyFingerprint(key)).toBe("Yw3N KWbE M2aR ElRI");
  });

  it("formats as four space-separated groups of four base64 characters", () => {
    expect(publicKeyFingerprint(new Uint8Array(32))).toMatch(/^[\w+/]{4}( [\w+/]{4}){3}$/);
  });
});
