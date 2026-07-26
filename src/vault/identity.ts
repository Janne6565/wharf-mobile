// Lazy X25519 identity bootstrap, run on first Projects use once the vault is
// unlocked. A TypeScript port of wharf-web's src/vault/identity.ts, adapted to the
// mobile on-device vault (file blob + meta + in-memory session) instead of the
// web's server-round-tripped session.
//
// The identity keypair lives INSIDE the personal vault payload (schema 2) so it
// syncs across devices and never touches the server; only the public half is
// published (PUT /users/me/public-key) so others can seal project DEKs to it.
//
// Three cases, mirroring the TUI + web:
//   * vault has an identity  → idempotently publish it if the server lacks one,
//     and — since the server is the one distributing the key others seal project
//     DEKs to — verify that the key it publishes for THIS account is ours.
//   * no identity, server HAS a key → this vault is behind the device that created
//     the identity; minting a second keypair would strand every DEK wrapped to the
//     real key. On mobile we first run a personal sync pass (the identity may be
//     arriving from the other device) and re-check; if still absent we report
//     "needs-sync" so the UI can tell the user to sync this vault first.
//   * neither → generate a keypair, write it into the vault (schema 2, preserving
//     unknown fields), versioned PUT the personal vault (409 → adopt remote and
//     retry once), then publish the public key.

import { getHttpStatus } from "@/api/httpError";
import { getCurrentUser, getVault, updatePublicKey, updateVault } from "@/api/wharf";
import { getMasterPassword } from "@/auth/masterSecret";
import type { UnlockedVault } from "@/crypto";
import {
  CryptoError,
  fromBase64,
  generateKeypair,
  openWithDek,
  publicKeyFingerprint,
  sealPayload,
  toBase64,
  unlockWithPassword,
} from "@/crypto";
import { store } from "@/store";
import { vaultDocumentUpdated } from "@/store/vaultSlice";
import { runSync } from "@/sync/engine";
import { fingerprint } from "@/sync/fingerprint";
import { parseVaultDocument, type VaultIdentity } from "./document";
import { type IdentityMismatch, setIdentityMismatch } from "./identityMismatch";
import { updateVaultMeta, writeVaultBlob } from "./storage";
import { getVaultSession, updateVaultSessionPayload } from "./vaultSession";

const CONFLICT = 409;

// The account's project identity, decoded into raw X25519 key bytes ready for the
// sealed-box unwrap of project DEKs.
export interface IdentityKeys {
  readonly publicKey: Uint8Array;
  readonly privateKey: Uint8Array;
}

export type IdentityStatus =
  | { readonly kind: "ready"; readonly keys: IdentityKeys }
  // The vault carries no identity but the server holds a key: this device must
  // sync the personal vault from the device that created the identity first.
  | { readonly kind: "needs-sync" }
  // The server publishes a public key for this account that is NOT the one in
  // this vault. Either another device rotated the identity and this vault is
  // stale, or the server (or someone who controls it) substituted a key — in
  // which case every project DEK sealed "to this account" is readable by whoever
  // holds the private half. Indistinguishable from the outside, so we stop and
  // let the user compare the two fingerprints against another client.
  | {
      readonly kind: "key-mismatch";
      readonly localFingerprint: string;
      readonly serverFingerprint: string;
    };

const encoder = new TextEncoder();
const decoder = new TextDecoder();

// withIdentity writes an identity into a decrypted vault payload without
// disturbing any other field (hosts incl. their stored passwords, settings). It
// parses the RAW JSON — deliberately NOT through the typed parser, which strips
// unknown fields — sets the identity and bumps schema to 2. Exported for tests.
export function withIdentity(payload: Uint8Array, identity: VaultIdentity): Uint8Array {
  const raw = JSON.parse(decoder.decode(payload)) as Record<string, unknown>;
  raw.identity = identity;
  const schema = typeof raw.schema === "number" ? raw.schema : 1;
  raw.schema = Math.max(schema, 2);
  return encoder.encode(JSON.stringify(raw));
}

function keysFromIdentity(identity: VaultIdentity): IdentityKeys {
  return {
    publicKey: fromBase64(identity.x25519Pub),
    privateKey: fromBase64(identity.x25519Priv),
  };
}

function sameBytes(a: Uint8Array, b: Uint8Array): boolean {
  return a.length === b.length && a.every((byte, i) => byte === b[i]);
}

// compareServerKey checks the key the server publishes for this account against
// the one in this vault, returning null when they are the same key and the
// fingerprint pair when they are not. The comparison is over the raw bytes (not
// the base64 text) so a re-encoding by the server is not read as a substitution.
// An undecodable published key throws out of `fromBase64` — the pass then fails
// closed, which is the right outcome for a server we cannot make sense of.
function compareServerKey(localBase64: string, serverBase64: string): IdentityMismatch | null {
  const local = fromBase64(localBase64);
  const server = fromBase64(serverBase64);
  if (sameBytes(local, server)) {
    return null;
  }
  return {
    localFingerprint: publicKeyFingerprint(local),
    serverFingerprint: publicKeyFingerprint(server),
  };
}

// publishKey publishes the account's public key. A 409 means the server already
// holds a key (a race, or a prior publish); we treat it as already-published
// rather than an error, since the caller only wants the key to be present.
async function publishKey(publicKey: string): Promise<void> {
  try {
    await updatePublicKey({ publicKey, rotate: false });
  } catch (error) {
    if (getHttpStatus(error) === CONFLICT) {
      return;
    }
    throw error;
  }
}

// openPersonalBlob opens a remote personal blob to its payload for the 409 adopt
// path: the cached DEK opens the common case (shared DEK), falling back to the
// retained master password when the remote was re-keyed elsewhere.
async function openPersonalBlob(session: UnlockedVault, blob: Uint8Array): Promise<Uint8Array> {
  try {
    return await openWithDek(blob, session.dek);
  } catch (error) {
    if (!(error instanceof CryptoError && error.code === "wrong-secret")) {
      throw error;
    }
  }
  const password = getMasterPassword();
  if (!password) {
    // Biometric-only session with a re-keyed remote: we cannot adopt to add the
    // identity. Surface as a conflict so the caller aborts the bootstrap.
    throw new CryptoError("wrong-secret", "identity bootstrap needs the master password");
  }
  return (await unlockWithPassword(blob, password)).payload;
}

// persistIdentityLocally writes the re-sealed personal blob to disk, records the
// server version + fingerprint, swaps the in-memory session payload (zeroing the
// old one, keeping the DEK/slots), and refreshes the derived Redux host list.
async function persistIdentityLocally(
  newPayload: Uint8Array,
  blob: Uint8Array,
  version: number,
): Promise<void> {
  writeVaultBlob(blob);
  await updateVaultMeta({ version, fingerprint: fingerprint(newPayload) });
  updateVaultSessionPayload(newPayload);
  const document = parseVaultDocument(newPayload);
  store.dispatch(vaultDocumentUpdated({ hosts: document.hosts, keys: document.keys, version }));
}

// pushIdentity seals the identity into the personal vault and uploads it with
// optimistic concurrency. On a 409 it adopts the remote payload, re-applies the
// identity onto it (never losing a concurrent remote edit) and retries once.
async function pushIdentity(
  session: UnlockedVault,
  identity: VaultIdentity,
  expectedVersion: number,
): Promise<{ payload: Uint8Array; blob: Uint8Array; version: number }> {
  const applyAndSeal = async (base: Uint8Array) => {
    const payload = withIdentity(base, identity);
    return { payload, blob: await sealPayload(session, payload) };
  };

  const first = await applyAndSeal(session.payload);
  try {
    const res = await updateVault({
      vault: toBase64(first.blob),
      expectedVersion,
    });
    return { ...first, version: res.version ?? expectedVersion + 1 };
  } catch (error) {
    if (getHttpStatus(error) !== CONFLICT) {
      throw error;
    }
  }

  const remote = await getVault();
  if (!remote.vault) {
    throw new CryptoError("corrupt", "remote vault vanished during identity bootstrap");
  }
  const remoteVersion = remote.version ?? 0;
  const basePayload = await openPersonalBlob(session, fromBase64(remote.vault));
  const retry = await applyAndSeal(basePayload);
  const res = await updateVault({ vault: toBase64(retry.blob), expectedVersion: remoteVersion });
  return { ...retry, version: res.version ?? remoteVersion + 1 };
}

// generateAndStore mints a keypair, writes it into the personal vault, pushes the
// versioned update, persists it on-device, then publishes the public key.
async function generateAndStore(
  session: UnlockedVault,
  expectedVersion: number,
): Promise<IdentityKeys> {
  const kp = await generateKeypair();
  const identity: VaultIdentity = {
    x25519Priv: toBase64(kp.privateKey),
    x25519Pub: toBase64(kp.publicKey),
    createdAt: new Date().toISOString(),
  };
  const { payload, blob, version } = await pushIdentity(session, identity, expectedVersion);
  await persistIdentityLocally(payload, blob, version);
  await publishKey(identity.x25519Pub);
  return keysFromIdentity(identity);
}

// ensureIdentity resolves the account's project identity for the current unlocked
// session, performing whichever of the three cases applies. It only ever writes on
// the generate path; the publish path is idempotent. The caller must pass the
// server version the local vault is based on (from vault.meta.json) as the
// expectedVersion for the generate-path PUT.
export async function ensureIdentity(expectedVersion: number): Promise<IdentityStatus> {
  const session = getVaultSession();
  if (!session) {
    return { kind: "needs-sync" };
  }
  const me = await getCurrentUser();
  const serverKey = me.publicKey ?? null;

  const doc = parseVaultDocument(session.payload);
  if (doc.identity) {
    if (!serverKey) {
      await publishKey(doc.identity.x25519Pub);
      setIdentityMismatch(null);
      return { kind: "ready", keys: keysFromIdentity(doc.identity) };
    }
    // The server both stores and hands out this account's public key, and no
    // client used to check that what it hands out is what the account actually
    // holds. Compare them: if they differ, every DEK sealed "to us" is being
    // sealed to a key we cannot open — a substituted key is silent otherwise,
    // showing up only as projects stuck in awaiting-access.
    const mismatch = compareServerKey(doc.identity.x25519Pub, serverKey);
    setIdentityMismatch(mismatch);
    if (mismatch) {
      return { kind: "key-mismatch", ...mismatch };
    }
    return { kind: "ready", keys: keysFromIdentity(doc.identity) };
  }

  if (serverKey) {
    // Server has a key but this vault carries none: run a personal sync pass in
    // case the identity is arriving from the device that created it, then re-check
    // rather than minting a divergent keypair.
    await runSync();
    const synced = getVaultSession();
    const syncedDoc = synced ? parseVaultDocument(synced.payload) : undefined;
    if (syncedDoc?.identity) {
      // Same check as above: the identity that just arrived must also match what
      // the server publishes for us.
      const mismatch = compareServerKey(syncedDoc.identity.x25519Pub, serverKey);
      setIdentityMismatch(mismatch);
      if (mismatch) {
        return { kind: "key-mismatch", ...mismatch };
      }
      return { kind: "ready", keys: keysFromIdentity(syncedDoc.identity) };
    }
    return { kind: "needs-sync" };
  }

  const keys = await generateAndStore(session, expectedVersion);
  setIdentityMismatch(null);
  return { kind: "ready", keys };
}

// republishLocalPublicKey re-publishes the public key held in THIS vault as the
// account's key, with `rotate: true` so the server accepts it over the key it
// currently holds. The remediation for a mismatch: the local key is the correct
// one (its private half is in the vault), so we never mint a new keypair — we
// only overwrite the server's copy.
//
// `rotate: true` nulls every wrapped project DEK server-side: each project
// re-enters awaiting-access until an admin re-seals the DEK to this key. The
// caller MUST confirm that with the user first.
export async function republishLocalPublicKey(): Promise<void> {
  const session = getVaultSession();
  const doc = session ? parseVaultDocument(session.payload) : undefined;
  if (!doc?.identity) {
    throw new CryptoError("corrupt", "no local identity to republish");
  }
  await updatePublicKey({ publicKey: doc.identity.x25519Pub, rotate: true });
  // The server now holds our key; clear the interlock so the next pass can seal
  // again without waiting for a full identity re-check.
  setIdentityMismatch(null);
}
