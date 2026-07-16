// Shared types for the personal-vault sync engine — a TypeScript port of
// wharf-tui's internal/sync (engine.go). The engine is deliberately split from
// its side-effects: PersonalSyncEngine (personal.ts) is the pure 2×2 state
// machine and depends only on the PersonalSyncDeps below, which the orchestrator
// (engine.ts) wires to the real API / vault storage / crypto / Redux. Tests
// inject fakes for every dep, exactly like engine.go's API + hook interfaces.

// The synced baseline: the server version the local vault agrees with, and the
// SHA-256 fingerprint of the payload at that version. Persisted in
// vault.meta.json (non-secret; see storage.ts).
export interface PersonalSyncState {
  readonly version: number;
  // null when no baseline has been recorded yet (a legacy blob or fresh device);
  // the engine backfills it on the first unlock.
  readonly fingerprint: string | null;
}

// The remote vault as fetched from the backend. `status: "absent"` maps the
// backend's 404 (no vault row for this account) — engine.go's api.ErrNoVault.
export type RemoteVault =
  | {
      readonly status: "present";
      readonly blob: Uint8Array;
      readonly version: number;
      readonly updatedAt: string | null;
    }
  | { readonly status: "absent" };

// A both-sides-changed situation the user must resolve. Carries only display
// counts + the remote version/timestamp — never payload bytes (those stay in the
// engine's in-memory `pending`, off Redux).
export interface Conflict {
  readonly localHosts: number;
  readonly remoteHosts: number;
  readonly remoteVersion: number;
  readonly remoteUpdatedAt: string | null;
}

// The outcome of one Sync/Resolve pass. Only `conflict` needs UI follow-up.
export type PersonalOutcome =
  | { readonly kind: "in-sync"; readonly version: number }
  | { readonly kind: "pushed"; readonly version: number }
  | { readonly kind: "adopted"; readonly version: number }
  | { readonly kind: "conflict"; readonly conflict: Conflict }
  // A transient network/protocol failure (rendered as offline), or the engine
  // could not open a moved remote (see needs-password below reusing this).
  | { readonly kind: "offline" }
  // The remote moved and adopting it requires the master password (the remote
  // blob was re-keyed under a different DEK), but this session unlocked via
  // biometrics only. The UI prompts for a password unlock, then re-syncs.
  | { readonly kind: "needs-password" };

// The side-effecting collaborators the state machine drives. Every method is
// async and may throw; the engine maps throws from fetch/push to "offline".
export interface PersonalSyncDeps {
  // The current in-memory decrypted payload (from the unlocked vault session).
  currentPayload(): Uint8Array;
  // The synced baseline (version + fingerprint) from persistent metadata.
  loadState(): Promise<PersonalSyncState>;
  // Fetch the remote vault (or report it absent). Throws on network failure.
  fetchRemote(): Promise<RemoteVault>;
  // Upload the local blob with optimistic concurrency. Resolves the new server
  // version, or rejects: a 409 must be reported as `VaultConflictError` so the
  // engine can re-pass; any other rejection is treated as offline.
  pushRemote(expectedVersion: number): Promise<number>;
  // Open a moved remote blob → its payload. Resolves "needs-password" when the
  // blob is re-keyed and no master password is retained (biometric-only session).
  openRemote(blob: Uint8Array): Promise<Uint8Array | "needs-password">;
  // Adopt a remote payload: reseal it under the LOCAL DEK, persist the blob +
  // meta at `version`, and refresh the derived Redux state. Keeps the DEK stable
  // so the biometric cache survives — the crux of the adopt-remote story.
  adopt(remotePayload: Uint8Array, version: number): Promise<void>;
  // Record agreement (version + fingerprint) without changing the blob.
  commit(version: number, fingerprint: string): Promise<void>;
}

// Marker error the pushRemote dep throws on a 409 so the engine re-passes once.
export class VaultConflictError extends Error {
  constructor() {
    super("vault version conflict");
    this.name = "VaultConflictError";
  }
}
