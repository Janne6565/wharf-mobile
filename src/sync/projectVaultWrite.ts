// The minimal project-vault WRITE path — the mobile v1 boundary is otherwise
// read-only for project vaults, and this is the sole exception: moving a personal
// host into a project. Every write is a read-modify-write of the FRESHLY FETCHED
// project blob under optimistic concurrency (the server 409s a stale version), so
// we never serialize Redux/derived state (which has host passwords stripped) into a
// vault — the moved host is copied as its RAW JSON from the decrypted personal
// vault and appended to the decrypted project document.
//
// Deps-injected like the rest of src/sync, so the whole flow unit-tests with fakes
// and no network (mirrors projectsDeps/projects.ts).

import { getHttpStatus } from "@/api/httpError";
import { getProjectVault, updateProjectVault } from "@/api/wharf";
import { fromBase64, openDek, openProject, sealProject, toBase64 } from "@/crypto";
import { store } from "@/store";
import { deleteHost } from "@/vault/hostMutations";
import { ensureIdentity, type IdentityKeys, type IdentityStatus } from "@/vault/identity";
import {
  addRawHostToPayload,
  extractRawHostFromPayload,
  setHostPasswordInPayload,
} from "@/vault/mutate";
import { getVaultSession } from "@/vault/vaultSession";
import { runProjectsSync } from "./projectsEngine";

const CONFLICT = 409;
const MAX_ATTEMPTS = 3;

export type ProjectWriteErrorCode =
  | "locked"
  | "needs-sync"
  | "awaiting-key"
  | "conflict"
  | "network";

export class ProjectWriteError extends Error {
  constructor(readonly code: ProjectWriteErrorCode) {
    super(`project write error: ${code}`);
    this.name = "ProjectWriteError";
  }
}

// The project vault as fetched for a write: the ciphertext blob, its server
// version (the expectedVersion for the PUT), and the caller's wrapped DEK.
interface FetchedProjectVault {
  readonly blob: Uint8Array | null;
  readonly version: number;
  readonly wrappedDek: Uint8Array | null;
}

// The side-effecting collaborators the write path drives. Injected so tests supply
// fakes; production wires the real API / crypto / identity / vault session below.
export interface ProjectWriteDeps {
  getVaultSession: () => { readonly payload: Uint8Array } | null;
  ensureIdentity: (expectedVersion: number) => Promise<IdentityStatus>;
  getVaultVersion: () => number;
  fetchVault: (id: string) => Promise<FetchedProjectVault>;
  updateProjectVault: (
    id: string,
    req: { readonly vault: string; readonly expectedVersion: number },
  ) => Promise<unknown>;
  openDek: (wrapped: Uint8Array, pub: Uint8Array, priv: Uint8Array) => Promise<Uint8Array>;
  openProject: (dek: Uint8Array, blob: Uint8Array) => Promise<Uint8Array>;
  sealProject: (dek: Uint8Array, payload: Uint8Array) => Promise<Uint8Array>;
  deleteHost: (id: string) => Promise<void>;
  runProjectsSync: () => Promise<void>;
}

const defaultDeps: ProjectWriteDeps = {
  getVaultSession,
  ensureIdentity,
  getVaultVersion: () => store.getState().vault.version ?? 0,
  fetchVault: async (id) => {
    const res = await getProjectVault(id);
    return {
      blob: res.vault ? fromBase64(res.vault) : null,
      version: res.version ?? 0,
      wrappedDek: res.wrappedDek ? fromBase64(res.wrappedDek) : null,
    };
  },
  updateProjectVault: (id, req) => updateProjectVault(id, req),
  openDek,
  openProject,
  sealProject,
  deleteHost,
  runProjectsSync,
};

// mutateProjectVault applies `mutate` to a project's decrypted document and writes
// it back under optimistic concurrency, retrying up to MAX_ATTEMPTS times on a 409
// (each attempt re-fetches, so we always rebase onto the latest server state). An
// error thrown by `mutate` (e.g. a HostMutationError name clash) is NOT caught — it
// propagates so the caller can give it distinct UI copy and skip the personal
// delete. A missing blob / wrapped DEK / un-openable DEK means we are not keyed →
// awaiting-key; a non-409 write failure or a fetch failure → network.
export async function mutateProjectVault(
  projectId: string,
  identity: IdentityKeys,
  mutate: (payload: Uint8Array) => Uint8Array,
  deps: ProjectWriteDeps = defaultDeps,
): Promise<void> {
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt += 1) {
    let remote: FetchedProjectVault;
    try {
      remote = await deps.fetchVault(projectId);
    } catch {
      throw new ProjectWriteError("network");
    }
    if (!remote.blob || !remote.wrappedDek) {
      throw new ProjectWriteError("awaiting-key");
    }

    let dek: Uint8Array;
    let payload: Uint8Array;
    try {
      dek = await deps.openDek(remote.wrappedDek, identity.publicKey, identity.privateKey);
      payload = await deps.openProject(dek, remote.blob);
    } catch {
      // The wrapped DEK does not open (rotated / foreign) or the blob will not
      // decrypt: this client is not keyed for the project.
      throw new ProjectWriteError("awaiting-key");
    }

    const nextPayload = mutate(payload);
    const blob = await deps.sealProject(dek, nextPayload);
    try {
      await deps.updateProjectVault(projectId, {
        vault: toBase64(blob),
        expectedVersion: remote.version,
      });
      return;
    } catch (error) {
      if (getHttpStatus(error) === CONFLICT) {
        continue; // stale version — re-fetch and rebase.
      }
      throw new ProjectWriteError("network");
    }
  }
  throw new ProjectWriteError("conflict");
}

// moveHostToProject re-homes a personal host into a project: it copies the host's
// RAW JSON (password and all) out of the decrypted personal vault, appends it to
// the project vault (only committing the personal removal once the project write
// succeeds, so a failure never loses the host), then re-syncs projects so the moved
// host surfaces under its new project section.
export async function moveHostToProject(
  hostId: string,
  projectId: string,
  deps: ProjectWriteDeps = defaultDeps,
): Promise<void> {
  const session = deps.getVaultSession();
  if (!session) {
    throw new ProjectWriteError("locked");
  }

  const identity = await deps.ensureIdentity(deps.getVaultVersion());
  if (identity.kind !== "ready") {
    throw new ProjectWriteError("needs-sync");
  }

  const rawHost = extractRawHostFromPayload(session.payload, hostId);
  // A HostMutationError here (e.g. a duplicate name in the project) propagates and
  // aborts before the personal delete below — the host is never lost.
  await mutateProjectVault(
    projectId,
    identity.keys,
    (payload) => addRawHostToPayload(payload, rawHost),
    deps,
  );

  await deps.deleteHost(hostId);
  void deps.runProjectsSync();
}

// setProjectHostPassword stores a per-host password on a host that lives inside a
// project vault and flips it to password auth — the project analogue of
// vault/hostMutations.setHostPassword, called by the terminal flow when the user
// ticks "remember" on a project host and the connect then succeeds. The password is
// written into the SHARED project vault, so it is visible to every member's client
// (matching the TUI's shared stored-password semantics). A HostMutationError
// ("not-found", host removed remotely meanwhile) from the mutation propagates like
// moveHostToProject's errors do.
export async function setProjectHostPassword(
  projectId: string,
  hostId: string,
  password: string,
  deps: ProjectWriteDeps = defaultDeps,
): Promise<void> {
  const session = deps.getVaultSession();
  if (!session) {
    throw new ProjectWriteError("locked");
  }

  const identity = await deps.ensureIdentity(deps.getVaultVersion());
  if (identity.kind !== "ready") {
    throw new ProjectWriteError("needs-sync");
  }

  await mutateProjectVault(
    projectId,
    identity.keys,
    (payload) => setHostPasswordInPayload(payload, hostId, password),
    deps,
  );

  // The re-pull is REQUIRED, not optional: readProjectStoredPassword reads the
  // on-disk project cache, which only a projects sync pass refreshes. Without it the
  // freshly-remembered password never lands in the cache, so the next connect would
  // still prompt for it.
  void deps.runProjectsSync();
}
