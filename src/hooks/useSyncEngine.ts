// Lifecycle owner for the sync engine. Mounted from the (tabs) layout, which
// only renders while the vault is unlocked, so the engine's triggers (AppState
// foreground + connectivity) and initial pass are active exactly for the unlocked
// session and torn down the moment it locks (background lock unmounts the tabs).

import { useEffect } from "react";
import { startSyncEngine, stopSyncEngine } from "@/sync/engine";

export function useSyncEngine(): void {
  useEffect(() => {
    startSyncEngine();
    return () => stopSyncEngine();
  }, []);
}
