// Shared types for the project-vault sync engine (M4). Like the personal engine,
// the project engine (projects.ts) is split from its side-effects: the engine is
// the pass logic and depends only on the ProjectSyncDeps below, which the
// orchestrator (projectsEngine.ts) wires to the real API / vault storage / crypto.
// Tests inject fakes for every dep.
//
// Mobile v1 project vaults are READ-ONLY: the plan defers project host editing, so
// the engine only ever fast-forward-pulls — there is no push, no per-project 2×2
// state machine, and no conflict path (all present in the TUI/web engines). The
// per-project meta baseline (version + fingerprint) is still recorded for parity
// and to detect an unchanged remote cheaply.

import type { ProjectSummary } from "@/api/generated/model";
import type { VaultHost } from "@/vault/document";
import type { ProjectMetaEntry } from "@/vault/storage";

export type ProjectRoleName = "MEMBER" | "ADMIN" | "OWNER";

// A UI snapshot of one project after a pass. `hosts` is empty when awaiting a key
// (the caller holds no wrapped DEK, or it no longer opens); `awaiting` marks that.
export interface ProjectView {
  readonly id: string;
  readonly name: string;
  readonly description: string;
  readonly role: ProjectRoleName;
  readonly memberCount: number;
  readonly pendingInviteCount: number;
  readonly version: number;
  readonly awaiting: boolean;
  readonly hosts: readonly VaultHost[];
}

// A pending invite received by the caller, flattened for the UI.
export interface InviteView {
  readonly id: string;
  readonly projectId: string;
  readonly projectName: string;
  readonly invitedByEmail: string;
}

// The outcome of one projects pass.
export type ProjectsOutcome =
  // A completed online pass: fresh views, ids dropped (vanished), pending invites.
  | {
      readonly kind: "ok";
      readonly views: ProjectView[];
      readonly removed: string[];
      readonly invites: InviteView[];
    }
  // The projects list could not be fetched (offline): cached views opened from the
  // on-disk blob cache, so an unlocked-but-offline client still renders hosts.
  | { readonly kind: "offline"; readonly views: ProjectView[] };

// The project vault as fetched from the backend, decoded to bytes. "not-found"
// maps the backend's 404 (the caller is no longer a member) → drop the project.
export type RemoteProjectVault =
  | {
      readonly status: "present";
      readonly blob: Uint8Array | null;
      readonly version: number;
      readonly wrappedDek: Uint8Array | null;
    }
  | { readonly status: "not-found" };

// The side-effecting collaborators the project engine drives. Every method is
// async and may throw; the engine maps a throw from listProjects to the offline
// (cached) path.
export interface ProjectSyncDeps {
  // List the caller's projects (summary incl. awaitingKey). Throws when offline.
  listProjects(): Promise<readonly ProjectSummary[]>;
  // The caller's pending received invites (best-effort; the engine tolerates a throw).
  fetchInvites(): Promise<readonly InviteView[]>;
  // The persisted per-project baseline map (id → entry) from vault.meta.json.
  loadMeta(): Promise<Record<string, ProjectMetaEntry>>;
  // Fetch a project's vault + the caller's current wrapped DEK. Reports "not-found"
  // for a 404 (membership vanished).
  fetchVault(id: string): Promise<RemoteProjectVault>;
  // Unwrap the caller's wrapped project DEK with the account identity. Resolves
  // null when the DEK does not open (rotated / foreign key) → awaiting access.
  openDek(wrappedDek: Uint8Array): Promise<Uint8Array | null>;
  // Open a project blob under its DEK → payload. Resolves null on any AEAD failure.
  openBlob(dek: Uint8Array, blob: Uint8Array): Promise<Uint8Array | null>;
  // Cache a successfully opened project: persist its blob + meta baseline.
  cacheProject(id: string, entry: ProjectMetaEntry, blob: Uint8Array): Promise<void>;
  // Forget a vanished project: delete its cache + meta.
  dropProject(id: string): Promise<void>;
  // Offline open of a cached project's blob via its stored wrapped DEK. Resolves
  // the decrypted payload, or null when the cache is missing / no longer opens.
  loadCached(id: string, entry: ProjectMetaEntry): Promise<Uint8Array | null>;
}
