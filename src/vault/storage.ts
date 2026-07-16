// On-device persistence of the (ciphertext) vault blob. SecureStore has a ~2 KB
// per-value ceiling and blobs run up to 1 MiB, so the blob lives as a file in the
// app's document directory (PLAN §B) — it is ciphertext by design, so the file
// system is an acceptable home. A small JSON metadata file alongside carries the
// non-secret sync bookkeeping (server version + payload fingerprint) and the
// owning account, used by the M3 sync engine and account reconciliation.
//
// Nothing in the metadata file is secret: the version and the SHA-256
// fingerprint of the payload reveal nothing about vault contents, and the userId
// / email only identify which account this device last synced (they are already
// in the JWT). Keeping them in plaintext (rather than sealed under a DEK subkey
// like the TUI's session.enc) means account reconciliation and offline bootstrap
// can read them BEFORE the vault is unlocked — exactly when they are needed.
//
// The expo-file-system API (SDK 57) is object-based: `new File(Paths.document,
// name)` with sync write/delete and async bytes(). Wrapped here behind a tiny
// module so tests can mock `expo-file-system` wholesale and the rest of the app
// never touches file URIs.

import { Directory, File, Paths } from "expo-file-system";

const BLOB_FILENAME = "vault.blob";
const META_FILENAME = "vault.meta.json";
const PROJECTS_DIRNAME = "projects";
const PROJECT_BLOB_SUFFIX = ".blob";

export interface VaultMeta {
  // The server-side vault version the local state is in agreement with — i.e.
  // the version the stored payload is based on, and the expectedVersion for the
  // next push. Advances only on a successful push or an adopted remote.
  readonly version: number;
  // ISO timestamp of when the blob was last written locally (diagnostics only).
  readonly storedAt: string;
  // The account this vault belongs to (account reconciliation, M3). Set on the
  // first unlock after a pull; a later sign-in with a different id wipes it.
  readonly userId?: string;
  // The account email, cached so an OFFLINE bootstrap can restore the signed-in
  // UI (id + email) without reaching the server.
  readonly userEmail?: string;
  // SHA-256 hex of the payload JSON at `version` — the sync engine's baseline
  // for "did the local vault change since we last agreed with the server?".
  readonly fingerprint?: string;
  // Per-project sync bookkeeping (M4), keyed by project id. Non-secret: the
  // wrapped DEK is a sealed-box ciphertext only the owner's X25519 private key
  // (which never leaves the encrypted personal payload) can open, so persisting
  // it in plaintext reveals nothing. The matching ciphertext blob lives beside
  // this file under projects/<id>.blob for offline opens.
  readonly projects?: Record<string, ProjectMetaEntry>;
}

// The per-project analogue of version/fingerprint, plus the caller's current
// wrapped DEK (base64) so a cached blob can be re-opened offline, and the
// display name/role so the projects list renders before a network sync.
export interface ProjectMetaEntry {
  readonly name: string;
  readonly role: string;
  readonly version: number;
  readonly fingerprint: string;
  readonly wrappedDek: string;
}

function blobFile(): File {
  return new File(Paths.document, BLOB_FILENAME);
}

function metaFile(): File {
  return new File(Paths.document, META_FILENAME);
}

// Write only the ciphertext blob file, leaving the metadata untouched. Used by
// local mutations (reseal under the same DEK) which change the blob but NOT the
// synced version/fingerprint — that stays put so the engine detects the drift.
export function writeVaultBlob(blob: Uint8Array): void {
  blobFile().write(blob);
}

// Merge a patch into the metadata file (creating it if absent), always bumping
// storedAt. Preserves fields the caller does not mention — so recording a
// fingerprint does not clobber the userId, and vice-versa.
export async function updateVaultMeta(patch: Partial<Omit<VaultMeta, "storedAt">>): Promise<void> {
  const existing = (await readVaultMeta()) ?? { version: 0, storedAt: "" };
  const next: VaultMeta = {
    ...existing,
    ...patch,
    storedAt: new Date().toISOString(),
  };
  metaFile().write(JSON.stringify(next));
}

// Persist a freshly pulled/adopted blob + its server version. Overwrites the
// blob atomically (File.write truncates and replaces) and merges the version
// into the metadata, preserving userId/email/fingerprint set elsewhere.
export async function storeVaultBlob(blob: Uint8Array, version: number): Promise<void> {
  writeVaultBlob(blob);
  await updateVaultMeta({ version });
}

// Read the locally stored blob, or null when none has been stored yet.
export async function readVaultBlob(): Promise<Uint8Array | null> {
  const file = blobFile();
  if (!file.exists) {
    return null;
  }
  return file.bytes();
}

// Read the stored metadata; null when missing or unparsable (treated as "no
// local vault" — the caller re-pulls).
export async function readVaultMeta(): Promise<VaultMeta | null> {
  const file = metaFile();
  if (!file.exists) {
    return null;
  }
  try {
    const parsed = JSON.parse(await file.text()) as Partial<VaultMeta>;
    if (typeof parsed.version !== "number") {
      return null;
    }
    return {
      version: parsed.version,
      storedAt: parsed.storedAt ?? "",
      ...(typeof parsed.userId === "string" ? { userId: parsed.userId } : {}),
      ...(typeof parsed.userEmail === "string" ? { userEmail: parsed.userEmail } : {}),
      ...(typeof parsed.fingerprint === "string" ? { fingerprint: parsed.fingerprint } : {}),
      ...(parsed.projects && typeof parsed.projects === "object"
        ? { projects: parsed.projects }
        : {}),
    };
  } catch {
    return null;
  }
}

// --- Per-project sync bookkeeping (M4) -----------------------------------------

function projectsDirectory(): Directory {
  return new Directory(Paths.document, PROJECTS_DIRNAME);
}

function projectBlobFile(id: string): File {
  return new File(Paths.document, PROJECTS_DIRNAME, `${id}${PROJECT_BLOB_SUFFIX}`);
}

// Read the whole project bookkeeping map (empty when none recorded yet).
export async function readProjectMeta(): Promise<Record<string, ProjectMetaEntry>> {
  return (await readVaultMeta())?.projects ?? {};
}

// Insert or replace a single project's bookkeeping entry, preserving the others.
export async function upsertProjectMeta(id: string, entry: ProjectMetaEntry): Promise<void> {
  const projects = { ...(await readProjectMeta()), [id]: entry };
  await updateVaultMeta({ projects });
}

// Forget a project's bookkeeping entry (membership vanished / not-found).
export async function deleteProjectMeta(id: string): Promise<void> {
  const projects = { ...(await readProjectMeta()) };
  if (!(id in projects)) {
    return;
  }
  delete projects[id];
  await updateVaultMeta({ projects });
}

// Persist a project's opaque ciphertext blob for offline opens (best-effort).
export function writeProjectBlob(id: string, blob: Uint8Array): void {
  const dir = projectsDirectory();
  if (!dir.exists) {
    dir.create({ intermediates: true });
  }
  projectBlobFile(id).write(blob);
}

// Read a cached project blob, or null when none is stored.
export async function readProjectBlob(id: string): Promise<Uint8Array | null> {
  const file = projectBlobFile(id);
  if (!file.exists) {
    return null;
  }
  return file.bytes();
}

// Remove a cached project blob (best-effort).
export function deleteProjectBlob(id: string): void {
  const file = projectBlobFile(id);
  if (file.exists) {
    file.delete();
  }
}

// Remove the local blob + metadata, including every cached project blob
// (sign-out, or account reconciliation wipe).
export async function clearVaultStorage(): Promise<void> {
  for (const file of [blobFile(), metaFile()]) {
    if (file.exists) {
      file.delete();
    }
  }
  const projects = projectsDirectory();
  if (projects.exists) {
    projects.delete();
  }
}
