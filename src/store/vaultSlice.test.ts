import type { VaultHost, VaultKeyMeta } from "@/vault/document";
import reducer, {
  setBiometricEnrolled,
  vaultDocumentUpdated,
  vaultLocked,
  vaultUnlocked,
} from "./vaultSlice";

const HOSTS: readonly VaultHost[] = [
  { id: "1", name: "homelab", user: "deniz", addr: "homelab.local", port: 22 },
];

const KEYS: readonly VaultKeyMeta[] = [
  {
    id: "k1",
    name: "id_ed25519",
    type: "ed25519",
    publicKey: "ssh-ed25519 AAAA comment",
    addedAt: "2026-07-19T00:00:00Z",
  },
];

describe("vaultSlice", () => {
  const initial = reducer(undefined, { type: "@@init" });

  it("starts locked with no hosts or keys", () => {
    expect(initial.status).toBe("locked");
    expect(initial.hosts).toEqual([]);
    expect(initial.keys).toEqual([]);
    expect(initial.version).toBeNull();
    expect(initial.biometricEnrolled).toBe(false);
  });

  it("unlock publishes hosts + keys + version and flips status", () => {
    const state = reducer(initial, vaultUnlocked({ hosts: HOSTS, keys: KEYS, version: 4 }));
    expect(state.status).toBe("unlocked");
    expect(state.hosts).toEqual(HOSTS);
    expect(state.keys).toEqual(KEYS);
    expect(state.version).toBe(4);
  });

  it("document update refreshes hosts + keys without touching lock status", () => {
    const unlocked = reducer(initial, vaultUnlocked({ hosts: [], keys: [], version: 1 }));
    const state = reducer(unlocked, vaultDocumentUpdated({ hosts: HOSTS, keys: KEYS, version: 2 }));
    expect(state.status).toBe("unlocked");
    expect(state.hosts).toEqual(HOSTS);
    expect(state.keys).toEqual(KEYS);
    expect(state.version).toBe(2);
  });

  it("lock clears the derived host + key lists (no plaintext residue in the store)", () => {
    const unlocked = reducer(initial, vaultUnlocked({ hosts: HOSTS, keys: KEYS, version: 4 }));
    const state = reducer(unlocked, vaultLocked());
    expect(state.status).toBe("locked");
    expect(state.hosts).toEqual([]);
    expect(state.keys).toEqual([]);
    expect(state.version).toBeNull();
  });

  it("lock preserves biometric enrolment (the DEK cache survives locking)", () => {
    const enrolled = reducer(initial, setBiometricEnrolled(true));
    const state = reducer(enrolled, vaultLocked());
    expect(state.biometricEnrolled).toBe(true);
  });
});
