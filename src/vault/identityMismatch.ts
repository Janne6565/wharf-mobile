// The process-wide "the server publishes a different public key for this account
// than the one in this vault" flag, set by ensureIdentity on every identity
// resolution and read by the safety interlocks that must not run while it holds.
//
// It lives in module memory rather than Redux on purpose: Redux carries the
// *display* copy of the mismatch (projectsSlice, for the warning banner), but a
// security interlock must not be gated on a store a caller could forget to wire
// (or on a dependency a caller could forget to pass). Anything that seals or
// distributes key material reads it from here directly.

export interface IdentityMismatch {
  // Fingerprint (publicKeyFingerprint format) of the key held in this vault.
  readonly localFingerprint: string;
  // Fingerprint of the key the server publishes for this account.
  readonly serverFingerprint: string;
}

let current: IdentityMismatch | null = null;

// setIdentityMismatch records the outcome of the last identity check — the
// mismatch, or null when the two keys agree (or no comparison was possible).
export function setIdentityMismatch(mismatch: IdentityMismatch | null): void {
  current = mismatch;
}

export function getIdentityMismatch(): IdentityMismatch | null {
  return current;
}

export function isIdentityMismatched(): boolean {
  return current !== null;
}
