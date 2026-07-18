import type { SshConnectOptions, SshSecretPromptEvent, SshVaultKeyRef } from "./contract";
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

describe("SshSecretPromptEvent kinds", () => {
  it("accepts the key-mode 'passphrase' kind alongside the password/ki kinds", () => {
    const kinds: SshSecretPromptEvent["kind"][] = [
      "password",
      "password_retry",
      "ki",
      "passphrase",
    ];
    // The prompt text for a passphrase is the key name; echo is always false.
    const ev: SshSecretPromptEvent = {
      promptId: "p1",
      sessionId: "s1",
      kind: "passphrase",
      prompt: "id_ed25519",
      echo: false,
    };
    expect(kinds).toContain(ev.kind);
    expect(ev.prompt).toBe("id_ed25519");
  });
});

describe("SshConnectOptions key-mode fields", () => {
  const base = {
    sessionId: "s1",
    host: "example.com",
    port: 22,
    user: "root",
    storedPassword: "",
    termType: "xterm-256color",
    cols: 80,
    rows: 24,
    timeoutMs: 5000,
    knownHostsPath: "/tmp/known_hosts",
  } as const;

  it("stays valid without the optional authMethod/keys (legacy callers)", () => {
    const opts: SshConnectOptions = { ...base };
    expect(opts.authMethod).toBeUndefined();
    expect(opts.keys).toBeUndefined();
  });

  it("carries authMethod 'key' and a list of vault key refs", () => {
    const keys: readonly SshVaultKeyRef[] = [
      { name: "id_ed25519", materialB64: "QUJD" },
      { name: "work_key", materialB64: "REVG" },
    ];
    const opts: SshConnectOptions = { ...base, authMethod: "key", keys };
    expect(opts.authMethod).toBe("key");
    expect(opts.keys).toHaveLength(2);
    expect(opts.keys?.[0]).toEqual({ name: "id_ed25519", materialB64: "QUJD" });
  });

  it("accepts an explicit 'password' authMethod", () => {
    const opts: SshConnectOptions = { ...base, authMethod: "password" };
    expect(opts.authMethod).toBe("password");
  });
});
