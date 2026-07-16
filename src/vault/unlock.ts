// Vault unlock orchestration (PLAN §B). Framework-free so it is unit-testable;
// the unlock screen's hook (src/features/unlock) wraps these with form/UI state.
//
// Two unlock paths prime the same in-memory session:
//   password  — argon2id KEK unwraps the DEK (wharfv.unlockWithPassword). Keeps
//               the master password in module memory for M3's adopt-remote.
//   biometric — the cached DEK from the requireAuthentication SecureStore entry
//               opens the body directly (crypto/wharfv-dek), zero argon2 passes.
//               A wrong-secret here means the blob was re-keyed on another
//               device: the stale cache is dropped and the caller falls back to
//               the password form.
//
// Both dispatch the derived, non-secret view (hosts + version) into vaultSlice;
// key material stays in src/vault/vaultSession and src/auth/masterSecret.

import { getVault } from "@/api/wharf";
import { clearMasterPassword, setMasterPassword } from "@/auth/masterSecret";
import { CryptoError, fromBase64, unlockVaultWithDek, unlockWithPassword } from "@/crypto";
import { store } from "@/store";
import { projectsReset } from "@/store/projectsSlice";
import { setBiometricEnrolled, vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import { establishSyncBaseline } from "@/sync/deps";
import {
  canEnrollBiometrics,
  clearBiometricDek,
  enrollBiometricDek,
  hasBiometricDek,
  readBiometricDek,
} from "./biometric";
import { parseVaultDocument } from "./document";
import { readVaultBlob, readVaultMeta, storeVaultBlob } from "./storage";
import { clearVaultSession, getVaultSession, setVaultSession } from "./vaultSession";

export type UnlockOutcome =
  | { readonly status: "unlocked" }
  // No vault exists locally or on the server (fresh OAuth account that has not
  // finished web onboarding).
  | { readonly status: "no-vault" }
  // Biometric only: prompt cancelled/failed or the cached DEK was stale.
  | { readonly status: "unavailable" };

interface LocalBlob {
  readonly blob: Uint8Array;
  readonly version: number | null;
}

// ensureVaultBlob returns the local blob, pulling and persisting it from the
// server on first use (first sign-in / pairing on this device). Server errors
// propagate to the caller; a signed-in account without a vault yields null.
export async function ensureVaultBlob(): Promise<LocalBlob | null> {
  const local = await readVaultBlob();
  if (local) {
    const meta = await readVaultMeta();
    return { blob: local, version: meta?.version ?? null };
  }
  const response = await getVault();
  if (!response.vault) {
    return null;
  }
  const blob = fromBase64(response.vault);
  const version = response.version ?? 0;
  await storeVaultBlob(blob, version);
  return { blob, version };
}

// publishUnlocked flips the derived state to unlocked and records the sync
// baseline (fingerprint + owning account) into the vault metadata, so the sync
// engine has a "last agreed" reference and account reconciliation an id to
// compare — before the tabs mount and fire the first sync pass.
async function publishUnlocked(payload: Uint8Array, version: number | null): Promise<void> {
  const document = parseVaultDocument(payload);
  store.dispatch(vaultUnlocked({ hosts: document.hosts, version }));
  await establishSyncBaseline(payload);
}

// Password unlock. Throws CryptoError("wrong-secret") on a bad password so the
// form can show a field-level error; other failures (network) also propagate.
export async function unlockVaultWithPassword(password: string): Promise<UnlockOutcome> {
  const local = await ensureVaultBlob();
  if (!local) {
    return { status: "no-vault" };
  }
  const unlocked = await unlockWithPassword(local.blob, password);
  setVaultSession(unlocked);
  setMasterPassword(password);
  await publishUnlocked(unlocked.payload, local.version);
  return { status: "unlocked" };
}

// Biometric unlock. Never throws for the expected failure modes — cancellation
// and stale-DEK both resolve to "unavailable" so the screen falls back to the
// password form without an error toast.
export async function unlockVaultWithBiometrics(prompt: string): Promise<UnlockOutcome> {
  const local = await ensureVaultBlob();
  if (!local) {
    return { status: "no-vault" };
  }
  const dek = await readBiometricDek(prompt);
  if (!dek) {
    return { status: "unavailable" };
  }
  try {
    const unlocked = await unlockVaultWithDek(local.blob, dek);
    setVaultSession(unlocked);
    await publishUnlocked(unlocked.payload, local.version);
    return { status: "unlocked" };
  } catch (error) {
    if (error instanceof CryptoError && error.code === "wrong-secret") {
      // Blob re-keyed elsewhere — the cached DEK is stale. Drop it and let the
      // user unlock with the password (which re-offers enrolment).
      await clearBiometricDek();
      store.dispatch(setBiometricEnrolled(false));
      return { status: "unavailable" };
    }
    throw error;
  } finally {
    dek.fill(0);
  }
}

// Whether the unlock screen should offer biometric enrolment after a successful
// password unlock: hardware + OS enrolment present, and no DEK cached yet.
export async function canOfferBiometricEnrollment(): Promise<boolean> {
  return (await canEnrollBiometrics()) && !(await hasBiometricDek());
}

// Cache the current session's DEK behind the biometric gate.
export async function enrollBiometricsForSession(prompt: string): Promise<boolean> {
  const session = getVaultSession();
  if (!session) {
    return false;
  }
  await enrollBiometricDek(session.dek, prompt);
  store.dispatch(setBiometricEnrolled(true));
  return true;
}

// lockVault zeroes every in-memory secret (DEK, payload, master password) and
// flips the derived state to locked. Called by the lock action and by the
// AppState background listener (lock-on-background, PLAN §B).
export function lockVault(): void {
  clearVaultSession();
  clearMasterPassword();
  store.dispatch(vaultLocked());
  store.dispatch(projectsReset());
}
