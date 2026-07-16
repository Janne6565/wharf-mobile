// Lock-on-background (PLAN §B): when the app leaves the foreground, every
// in-memory secret — DEK, decrypted payload, master password — is zeroed and the
// derived vault state flips to locked, so returning foregrounds onto the unlock
// screen (biometric re-prompt if enrolled).
//
// Listens for the "background" state only, NOT "inactive": iOS reports inactive
// during transient system UI (the Face ID sheet itself, control centre, the app
// switcher flick), and locking there would cancel the very biometric prompt the
// unlock screen fires.

import { useEffect } from "react";
import { AppState } from "react-native";
import { store } from "@/store";
import { lockVault } from "@/vault/unlock";

export function useLockOnBackground(): void {
  useEffect(() => {
    const subscription = AppState.addEventListener("change", (state) => {
      if (state === "background" && store.getState().vault.status === "unlocked") {
        lockVault();
      }
    });
    return () => subscription.remove();
  }, []);
}
