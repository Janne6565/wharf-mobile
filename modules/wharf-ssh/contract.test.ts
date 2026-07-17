import { parseSshErrorCode, SSH_ERROR_CODES } from "./contract";

describe("parseSshErrorCode", () => {
  it("recovers every stable code from a bare token", () => {
    for (const code of SSH_ERROR_CODES) {
      expect(parseSshErrorCode(code)).toBe(code);
    }
  });

  it("recovers the code from a 'code: detail' message", () => {
    expect(parseSshErrorCode("auth_failed: too many authentication failures")).toBe("auth_failed");
    expect(parseSshErrorCode("host_key_changed: fingerprint mismatch")).toBe("host_key_changed");
  });

  it("tolerates leading whitespace and a space separator", () => {
    expect(parseSshErrorCode("  timeout dialing host")).toBe("timeout");
  });

  it("recovers the code when the native message is wrapped by expo-modules-core", () => {
    expect(parseSshErrorCode("ERR_SSH_CONNECT: auth_failed: bad credentials")).toBe("auth_failed");
    expect(parseSshErrorCode("Error: timeout: dial tcp: i/o timeout")).toBe("timeout");
  });

  it("picks the earliest code in the string, not the first in array order", () => {
    // "timeout" precedes "auth_failed" in the message; array order lists
    // auth_failed first, but position must win.
    expect(parseSshErrorCode("timeout: then auth_failed later")).toBe("timeout");
  });

  it("matches whole words only — a code inside a longer word does not count", () => {
    expect(parseSshErrorCode("networking issue while dialing")).toBe("unknown");
    expect(parseSshErrorCode("auth_failed_x: not our code")).toBe("unknown");
  });

  it("falls back to 'unknown' for unrecognised or empty input", () => {
    expect(parseSshErrorCode("")).toBe("unknown");
    expect(parseSshErrorCode("boom")).toBe("unknown");
    expect(parseSshErrorCode("Error: something")).toBe("unknown");
  });
});
