// Logic for the sync conflict sheet. The sheet appears when the engine detected
// a both-sides-changed conflict (zero-hosts cases auto-resolve in the engine and
// never surface here). keep-local overwrites the remote with this device's vault;
// take-remote discards local changes and adopts the remote. Both run on the
// engine instance that stashed the remote payload.

import { useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { resolveConflict } from "@/sync/engine";

export function useSyncConflictLogic() {
  const conflict = useAppSelector((state) => state.sync.conflict);
  const resolving = useAppSelector((state) => state.sync.phase === "syncing");

  const keepLocal = useCallback(() => {
    void resolveConflict(true);
  }, []);

  const takeRemote = useCallback(() => {
    void resolveConflict(false);
  }, []);

  return { conflict, resolving, keepLocal, takeRemote };
}

// formatRemoteUpdatedAt renders the remote's server timestamp for the sheet, or
// null when the backend did not report one.
export function formatRemoteUpdatedAt(iso: string | null): string | null {
  if (!iso) {
    return null;
  }
  const date = new Date(iso);
  return Number.isNaN(date.getTime()) ? null : date.toLocaleString();
}
