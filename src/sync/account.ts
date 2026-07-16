// Account reconciliation (M2 handoff gap): a device can hold a cached vault blob
// for account A while account B signs in (A never signed out — the app was killed,
// or B paired over A). B's password/DEK cannot open A's blob, and silently
// leaving A's hosts on screen would be wrong. So on every session establishment
// we compare the account the blob belongs to (recorded in vault.meta.json) with
// the account that just signed in; a mismatch wipes the blob, its metadata and
// the biometric DEK cache, forcing a clean refetch for the new account.
//
// The first sign-in on a fresh device has no recorded userId, so nothing is
// wiped — the baseline is recorded on that account's first unlock instead.

import { store } from "@/store";
import { setBiometricEnrolled } from "@/store/vaultSlice";
import { clearBiometricDek } from "@/vault/biometric";
import { clearVaultStorage, readVaultMeta } from "@/vault/storage";

// reconcileVaultAccount wipes the local vault when it belongs to a different
// account than userId. Safe to call on every bootstrap / sign-in.
export async function reconcileVaultAccount(userId: string): Promise<boolean> {
  const meta = await readVaultMeta();
  if (!meta?.userId || meta.userId === userId) {
    return false;
  }
  await clearVaultStorage();
  await clearBiometricDek();
  store.dispatch(setBiometricEnrolled(false));
  return true;
}
