// The project-host counterpart of vault/hostSecret.ts. That module reads a stored
// password out of the RAW decrypted PERSONAL payload; a host moved into a project
// no longer lives there (readStoredPassword returns "" for it), so its stored
// secret must instead be read out of the LOCALLY CACHED project blob. Same
// transient-secret discipline as hostSecret.ts: the password is only ever read at
// connect time and handed straight to the native engine — never placed in Redux or
// in state that outlives the connection flow.
//
// Fully offline: it opens the on-disk project cache (no network), and every failure
// path resolves "" so the terminal engine simply falls back to prompting. Structured
// deps-injected with production defaults (mirrors projectVaultWrite.ts) so it
// unit-tests with fakes and no live vault/crypto/storage.

import { store } from "@/store";
import { extractStoredPassword } from "@/vault/hostSecret";
import { ensureIdentity, type IdentityKeys, type IdentityStatus } from "@/vault/identity";
import { type ProjectMetaEntry, readProjectMeta } from "@/vault/storage";
import { makeProjectSyncDeps } from "./projectsDeps";

// The side-effecting collaborators the read path drives. Injected so tests supply
// fakes; production wires the real store / identity / storage / crypto below.
export interface ProjectHostSecretDeps {
  getVaultVersion: () => number;
  ensureIdentity: (expectedVersion: number) => Promise<IdentityStatus>;
  readProjectMeta: () => Promise<Record<string, ProjectMetaEntry>>;
  // Unwraps the entry's wrapped DEK with the caller's identity and opens the
  // on-disk project blob to its decrypted payload; null when not keyed / no cache.
  loadCached: (
    keys: IdentityKeys,
    projectId: string,
    entry: ProjectMetaEntry,
  ) => Promise<Uint8Array | null>;
  extractStoredPassword: (payload: Uint8Array, hostId: string) => string;
}

const defaultDeps: ProjectHostSecretDeps = {
  getVaultVersion: () => store.getState().vault.version ?? 0,
  ensureIdentity,
  readProjectMeta,
  loadCached: (keys, projectId, entry) => makeProjectSyncDeps(keys).loadCached(projectId, entry),
  extractStoredPassword,
};

// readProjectStoredPassword resolves the stored password for a host inside a
// project from the locally cached project blob. Returns "" — so the engine falls
// back to prompting — when the vault is locked / this device lacks the identity
// (needs-sync), the project has no local meta entry, its cached blob will not open,
// or the host has no stored password. Never throws.
export async function readProjectStoredPassword(
  projectId: string,
  hostId: string,
  deps: ProjectHostSecretDeps = defaultDeps,
): Promise<string> {
  try {
    const identity = await deps.ensureIdentity(deps.getVaultVersion());
    if (identity.kind !== "ready") {
      return "";
    }
    const meta = await deps.readProjectMeta();
    const entry = meta[projectId];
    if (!entry) {
      return "";
    }
    const payload = await deps.loadCached(identity.keys, projectId, entry);
    if (!payload) {
      return "";
    }
    return deps.extractStoredPassword(payload, hostId);
  } catch {
    return "";
  }
}
