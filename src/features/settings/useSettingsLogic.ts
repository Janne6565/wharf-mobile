import { useRouter } from "expo-router";
import { useCallback } from "react";
import { clearSession } from "@/auth/session";
import { useAppSelector } from "@/store/hooks";
import { lockVault } from "@/vault/unlock";

// Surfaces the current settings values for the static Settings rows plus the
// session actions (lock vault, sign out — the routing guards handle where the
// user lands). Theme and language pickers land in M6; for now the rows display
// the active values from the store. The Developer row (dev builds only) opens
// the crypto self-test — the M1 on-device acceptance gate.
export function useSettingsLogic() {
  const accent = useAppSelector((state) => state.settings.accent);
  const language = useAppSelector((state) => state.settings.language);
  const router = useRouter();

  const showDeveloper = __DEV__;
  const openCryptoSelfTest = useCallback(() => {
    router.push("/dev/crypto-selftest");
  }, [router]);

  const lock = useCallback(() => {
    lockVault();
  }, []);

  const signOut = useCallback(() => {
    void clearSession();
  }, []);

  return { accent, language, showDeveloper, openCryptoSelfTest, lock, signOut };
}
