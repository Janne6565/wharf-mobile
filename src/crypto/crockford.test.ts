import {
  decodeCrockford,
  encodeCrockford,
  formatRecoveryGroups,
  looksLikeRecoveryCode,
  normalizeRecovery,
  RECOVERY_CODE_LEN,
  RECOVERY_SECRET_LEN,
  recoverySecretFromCode,
} from "./crockford";

describe("crockford", () => {
  it("encodes 25 bytes to a 40-char code", () => {
    const secret = new Uint8Array(RECOVERY_SECRET_LEN).fill(0xff);
    const code = encodeCrockford(secret);
    expect(code).toHaveLength(RECOVERY_CODE_LEN);
  });

  it("round-trips encode -> decode", () => {
    const secret = Uint8Array.from({ length: RECOVERY_SECRET_LEN }, (_, i) => (i * 37 + 11) & 0xff);
    const code = encodeCrockford(secret);
    expect(decodeCrockford(code)).toEqual(secret);
  });

  it("encodes all-zero bytes to all-zero characters", () => {
    const secret = new Uint8Array(RECOVERY_SECRET_LEN);
    expect(encodeCrockford(secret)).toBe("0".repeat(RECOVERY_CODE_LEN));
  });

  describe("normalizeRecovery", () => {
    it("uppercases, strips dashes/spaces/newlines", () => {
      expect(normalizeRecovery("k7pqm-x2rtf\n9wkdn a4bzc")).toBe("K7PQMX2RTF9WKDNA4BZC");
    });

    it("folds I and L to 1, O to 0", () => {
      expect(normalizeRecovery("ilo")).toBe("110");
      expect(normalizeRecovery("ILO")).toBe("110");
    });
  });

  it("recovers the identical secret from a messy, grouped code", () => {
    const secret = Uint8Array.from({ length: RECOVERY_SECRET_LEN }, (_, i) => (i * 13 + 5) & 0xff);
    const code = encodeCrockford(secret);
    const messy = `${code.slice(0, 5)}-${code.slice(5, 10)} ${code.slice(10)}`.toLowerCase();
    expect(recoverySecretFromCode(messy)).toEqual(secret);
  });

  it("rejects a code of the wrong length", () => {
    expect(() => recoverySecretFromCode("ABC")).toThrow();
  });

  it("rejects characters outside the alphabet", () => {
    // 'U' is intentionally excluded from Crockford base32.
    expect(() => decodeCrockford("U".repeat(RECOVERY_CODE_LEN))).toThrow();
  });

  describe("looksLikeRecoveryCode", () => {
    it("accepts a well-formed grouped code", () => {
      const code = encodeCrockford(new Uint8Array(RECOVERY_SECRET_LEN).fill(1));
      const grouped = formatRecoveryGroups(code).join("-");
      expect(looksLikeRecoveryCode(grouped)).toBe(true);
    });

    it("rejects a short code", () => {
      expect(looksLikeRecoveryCode("K7PQM")).toBe(false);
    });
  });

  it("formats a code into 8 groups of 5", () => {
    const code = encodeCrockford(new Uint8Array(RECOVERY_SECRET_LEN).fill(0));
    const groups = formatRecoveryGroups(code);
    expect(groups).toHaveLength(8);
    for (const g of groups) {
      expect(g).toHaveLength(5);
    }
  });
});
