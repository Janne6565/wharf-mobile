import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { VaultHost, VaultKeyMeta } from "@/vault/document";

// Derived, non-secret vault state for the UI. The secret material (DEK, decrypted
// payload, master password) lives ONLY in module memory (`src/vault/vaultSession`
// and `src/auth/masterSecret`), never here — Redux state is serializable and must
// not carry key material. This slice holds the parsed host list and lock status
// so the Hosts tab and routing guards can read them synchronously.
//
// On lock (manual, or on app-background per PLAN §B) the host list is cleared and
// status returns to "locked"; the caller separately zeroes the module-memory
// secrets. `biometricEnrolled` mirrors whether a DEK is cached behind biometrics,
// so the unlock screen knows to attempt a biometric prompt on mount.

export type VaultStatus = "locked" | "unlocked";

interface VaultState {
  status: VaultStatus;
  hosts: StoredHost[];
  keys: VaultKeyMeta[];
  version: number | null;
  biometricEnrolled: boolean;
}

const initialState: VaultState = {
  status: "locked",
  hosts: [],
  keys: [],
  version: null,
  biometricEnrolled: false,
};

interface UnlockedPayload {
  readonly hosts: readonly VaultHost[];
  readonly keys: readonly VaultKeyMeta[];
  readonly version: number | null;
}

// Immer drafts are deeply mutable, so the slice stores hosts in a mutable
// mirror of VaultHost (only `tags` is an array and needs the deep copy).
// StoredHost is assignable to VaultHost, so selectors still satisfy consumers
// typed against the readonly document shape.
type StoredHost = Omit<VaultHost, "tags"> & { tags?: string[] };

function toStoredHosts(hosts: readonly VaultHost[]): StoredHost[] {
  return hosts.map((host) => ({
    ...host,
    tags: host.tags ? [...host.tags] : undefined,
  }));
}

// VaultKeyMeta has no nested arrays (only strings), so a shallow array copy into
// a mutable array is enough for Immer — the reducers only ever replace the whole
// list, never mutate an element in place.
function toStoredKeys(keys: readonly VaultKeyMeta[]): VaultKeyMeta[] {
  return [...keys];
}

const vaultSlice = createSlice({
  name: "vault",
  initialState,
  reducers: {
    vaultUnlocked(state, action: PayloadAction<UnlockedPayload>) {
      state.status = "unlocked";
      state.hosts = toStoredHosts(action.payload.hosts);
      state.keys = toStoredKeys(action.payload.keys);
      state.version = action.payload.version;
    },
    // Refresh the decrypted host + key lists without changing lock status (e.g.
    // after a host mutation or a future sync pull).
    vaultDocumentUpdated(state, action: PayloadAction<UnlockedPayload>) {
      state.hosts = toStoredHosts(action.payload.hosts);
      state.keys = toStoredKeys(action.payload.keys);
      state.version = action.payload.version;
    },
    vaultLocked(state) {
      state.status = "locked";
      state.hosts = [];
      state.keys = [];
      state.version = null;
    },
    setBiometricEnrolled(state, action: PayloadAction<boolean>) {
      state.biometricEnrolled = action.payload;
    },
  },
});

export const { vaultUnlocked, vaultDocumentUpdated, vaultLocked, setBiometricEnrolled } =
  vaultSlice.actions;
export default vaultSlice.reducer;
