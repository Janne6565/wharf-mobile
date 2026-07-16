// In-memory holder for the unlocked vault (DEK + decrypted payload) of the
// current session. It is NEVER persisted or serialized — it exists only so an
// unlocked session keeps the vault "primed" in memory, exactly like the Go TUI
// holds the DEK for its process lifetime. Redux carries only the derived,
// non-secret view (vaultSlice); this module carries the key material.
//
// clearVaultSession explicitly zeroes the DEK and payload buffers before
// dropping the reference — Uint8Arrays are mutable, so unlike the master
// password string these CAN be genuinely wiped (lock-on-background, PLAN §B).

import type { UnlockedVault } from "@/crypto";

let current: UnlockedVault | null = null;

export function setVaultSession(vault: UnlockedVault): void {
  current = vault;
}

export function getVaultSession(): UnlockedVault | null {
  return current;
}

export function clearVaultSession(): void {
  if (current) {
    current.dek.fill(0);
    current.payload.fill(0);
  }
  current = null;
}
