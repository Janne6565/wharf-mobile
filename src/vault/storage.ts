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

import { File, Paths } from "expo-file-system";

const BLOB_FILENAME = "vault.blob";
const META_FILENAME = "vault.meta.json";

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
    };
  } catch {
    return null;
  }
}

// Remove the local blob + metadata (sign-out, or account reconciliation wipe).
export async function clearVaultStorage(): Promise<void> {
  for (const file of [blobFile(), metaFile()]) {
    if (file.exists) {
      file.delete();
    }
  }
}
