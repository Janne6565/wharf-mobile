// Public surface of the sync module.

export { reconcileVaultAccount } from "./account";
export { isOnline } from "./connectivity";
export { establishSyncBaseline } from "./deps";
export {
  resolveConflict,
  runSync,
  scheduleSyncPush,
  startSyncEngine,
  stopSyncEngine,
} from "./engine";
export { countHosts, fingerprint } from "./fingerprint";
export { PersonalSyncEngine } from "./personal";
export type {
  Conflict,
  PersonalOutcome,
  PersonalSyncDeps,
  PersonalSyncState,
  RemoteVault,
} from "./types";
export { VaultConflictError } from "./types";
