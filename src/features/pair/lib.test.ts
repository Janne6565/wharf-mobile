import { formatPairingCode, isCompletePairingCode, rawPairingCode } from "./lib";

describe("pairing code helpers", () => {
  it("uppercases and strips separators/junk", () => {
    expect(rawPairingCode(" ab-cd 12!34 ")).toBe("ABCD1234");
  });

  it("caps at 8 characters", () => {
    expect(rawPairingCode("abcd1234extra")).toBe("ABCD1234");
  });

  it("formats with a dash once the first group is complete", () => {
    expect(formatPairingCode("ab")).toBe("AB");
    expect(formatPairingCode("abcd")).toBe("ABCD");
    expect(formatPairingCode("abcd1")).toBe("ABCD-1");
    expect(formatPairingCode("abcd1234")).toBe("ABCD-1234");
  });

  it("re-formats an already formatted value idempotently", () => {
    expect(formatPairingCode("ABCD-1234")).toBe("ABCD-1234");
  });

  it("detects completeness on the raw length", () => {
    expect(isCompletePairingCode("ABCD-123")).toBe(false);
    expect(isCompletePairingCode("ABCD-1234")).toBe(true);
    expect(isCompletePairingCode("abcd1234")).toBe(true);
  });
});
