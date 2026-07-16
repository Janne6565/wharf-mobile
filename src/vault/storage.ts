// On-device persistence of the (ciphertext) vault blob. SecureStore has a ~2 KB
// per-value ceiling and blobs run up to 1 MiB, so the blob lives as a file in the
// app's document directory (PLAN §B) — it is ciphertext by design, so the file
// system is an acceptable home. A small JSON metadata file alongside carries the
// server version for optimistic concurrency (the sync engine's input in M3).
//
// The expo-file-system API (SDK 57) is object-based: `new File(Paths.document,
// name)` with sync write/delete and async bytes(). Wrapped here behind a tiny
// module so tests can mock `expo-file-system` wholesale and the rest of the app
// never touches file URIs.

import { File, Paths } from "expo-file-system";

const BLOB_FILENAME = "vault.blob";
const META_FILENAME = "vault.meta.json";

export interface VaultMeta {
  // The server-side vault version this blob corresponds to.
  readonly version: number;
  // ISO timestamp of when the blob was stored locally (diagnostics only).
  readonly storedAt: string;
}

function blobFile(): File {
  return new File(Paths.document, BLOB_FILENAME);
}

function metaFile(): File {
  return new File(Paths.document, META_FILENAME);
}

// Persist a freshly pulled blob + its server version. Overwrites atomically from
// the caller's perspective (File.write truncates and replaces).
export async function storeVaultBlob(blob: Uint8Array, version: number): Promise<void> {
  const meta: VaultMeta = { version, storedAt: new Date().toISOString() };
  blobFile().write(blob);
  metaFile().write(JSON.stringify(meta));
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
    return { version: parsed.version, storedAt: parsed.storedAt ?? "" };
  } catch {
    return null;
  }
}

// Remove the local blob + metadata (sign-out).
export async function clearVaultStorage(): Promise<void> {
  for (const file of [blobFile(), metaFile()]) {
    if (file.exists) {
      file.delete();
    }
  }
}
