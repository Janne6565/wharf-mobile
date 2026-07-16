// The concrete PersonalSyncDeps: the bridge between the pure sync state machine
// (personal.ts) and the app's API client, on-device vault storage, crypto and
// Redux. Split out from the orchestrator so the state machine's collaborators are
// named in one place and the orchestrator stays about scheduling/triggers.
//
// The adopt-remote DEK story lives here (adoptRemotePayload + openRemoteBlob):
//   • A remote blob carries its OWN key slots. In the common case every device
//     shares one DEK (the vault's DEK, unwrapped by the shared master password),
//     so the local cached DEK opens the remote body directly — no password, so a
//     biometric-only session can still pull. openRemoteBlob tries that first.
//   • If the remote was re-keyed elsewhere (recovery reset → fresh DEK), the
//     cached DEK fails; we fall back to the master password (unlockWithPassword),
//     which derives the KEK from the remote's own salts. With no password
//     retained (biometric-only), we report "needs-password" and let the UI
//     re-prompt.
//   • Either way, adopt RE-SEALS the remote payload under the LOCAL DEK via
//     sealPayload (same slots, same DEK, fresh body). The on-disk blob therefore
//     always uses OUR DEK, so the biometric DEK cache stays valid across adopts —
//     the whole point of re-encrypting rather than storing the remote blob as-is.

import { getHttpStatus } from "@/api/httpError";
import { getVault, updateVault } from "@/api/wharf";
import { getMasterPassword } from "@/auth/masterSecret";
import {
  CryptoError,
  fromBase64,
  openWithDek,
  sealPayload,
  toBase64,
  unlockWithPassword,
} from "@/crypto";
import { store } from "@/store";
import { vaultDocumentUpdated } from "@/store/vaultSlice";
import { parseVaultDocument } from "@/vault/document";
import { readVaultBlob, readVaultMeta, updateVaultMeta, writeVaultBlob } from "@/vault/storage";
import { getVaultSession, updateVaultSessionPayload } from "@/vault/vaultSession";
import { fingerprint } from "./fingerprint";
import type { PersonalSyncDeps, PersonalSyncState, RemoteVault } from "./types";
import { VaultConflictError } from "./types";

const HTTP_NOT_FOUND = 404;
const HTTP_CONFLICT = 409;

function requireSession() {
  const session = getVaultSession();
  if (!session) {
    throw new Error("sync: vault is locked");
  }
  return session;
}

function currentPayload(): Uint8Array {
  return requireSession().payload;
}

async function loadState(): Promise<PersonalSyncState> {
  const meta = await readVaultMeta();
  return { version: meta?.version ?? 0, fingerprint: meta?.fingerprint ?? null };
}

async function fetchRemote(): Promise<RemoteVault> {
  try {
    const res = await getVault();
    if (!res.vault) {
      return { status: "absent" };
    }
    return {
      status: "present",
      blob: fromBase64(res.vault),
      version: res.version ?? 0,
      updatedAt: res.updatedAt ?? null,
    };
  } catch (error) {
    if (getHttpStatus(error) === HTTP_NOT_FOUND) {
      return { status: "absent" };
    }
    throw error;
  }
}

async function pushRemote(expectedVersion: number): Promise<number> {
  const blob = await readVaultBlob();
  if (!blob) {
    throw new Error("sync: no local blob to push");
  }
  try {
    const res = await updateVault({ vault: toBase64(blob), expectedVersion });
    return res.version ?? expectedVersion + 1;
  } catch (error) {
    if (getHttpStatus(error) === HTTP_CONFLICT) {
      throw new VaultConflictError();
    }
    throw error;
  }
}

async function openRemote(blob: Uint8Array): Promise<Uint8Array | "needs-password"> {
  const session = requireSession();
  try {
    // Common case: the remote shares our DEK, so the cached DEK opens it — no
    // password needed, which is what lets a biometric-only session pull.
    return await openWithDek(blob, session.dek);
  } catch (error) {
    // Only a wrong-secret (re-keyed remote) warrants the password fallback; a
    // corrupt/short blob is a real failure and propagates.
    if (!(error instanceof CryptoError && error.code === "wrong-secret")) {
      throw error;
    }
  }
  const password = getMasterPassword();
  if (!password) {
    return "needs-password";
  }
  const unlocked = await unlockWithPassword(blob, password);
  return unlocked.payload;
}

async function adopt(remotePayload: Uint8Array, version: number): Promise<void> {
  const session = requireSession();
  // Re-seal the remote payload under OUR DEK + slots (fresh body nonce), so the
  // stored blob keeps our DEK and the biometric cache stays valid.
  const newBlob = await sealPayload(session, remotePayload);
  writeVaultBlob(newBlob);
  await updateVaultMeta({ version, fingerprint: fingerprint(remotePayload) });
  updateVaultSessionPayload(remotePayload);
  const document = parseVaultDocument(remotePayload);
  store.dispatch(vaultDocumentUpdated({ hosts: document.hosts, version }));
}

async function commit(version: number, fp: string): Promise<void> {
  await updateVaultMeta({ version, fingerprint: fp });
}

// The singleton real deps object handed to the PersonalSyncEngine in production.
export const personalSyncDeps: PersonalSyncDeps = {
  currentPayload,
  loadState,
  fetchRemote,
  pushRemote,
  openRemote,
  adopt,
  commit,
};

// establishSyncBaseline records the fingerprint + owning account into the vault
// metadata on the first unlock after a pull, so the engine has a "last agreed"
// baseline and account reconciliation has an id to compare. It never overwrites
// an existing fingerprint (that would erase a pending, unpushed local edit) or an
// existing userId — it only backfills what is missing.
export async function establishSyncBaseline(payload: Uint8Array): Promise<void> {
  const meta = await readVaultMeta();
  const patch: { fingerprint?: string; userId?: string; userEmail?: string } = {};
  if (!meta?.fingerprint) {
    patch.fingerprint = fingerprint(payload);
  }
  const user = store.getState().auth.user;
  if (user && !meta?.userId) {
    patch.userId = user.id;
    patch.userEmail = user.email;
  }
  if (Object.keys(patch).length > 0) {
    await updateVaultMeta(patch);
  }
}
