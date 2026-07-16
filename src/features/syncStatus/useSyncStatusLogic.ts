// Selects the coarse sync status the banner renders. needs-password takes
// precedence over offline: it is actionable (unlock with the password) whereas
// offline resolves itself on reconnect.

import { useAppSelector } from "@/store/hooks";

export type SyncBannerKind = "needs-password" | "offline" | null;

export function useSyncStatusLogic(): SyncBannerKind {
  return useAppSelector((state) => {
    if (state.sync.needsPassword) {
      return "needs-password";
    }
    if (state.sync.offline) {
      return "offline";
    }
    return null;
  });
}
