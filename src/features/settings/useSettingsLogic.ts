import { useRouter } from "expo-router";
import { useCallback } from "react";
import { useAppSelector } from "@/store/hooks";

// Surfaces the current settings values for the static Settings rows. Theme and
// language pickers (which dispatch setAccent/persistLanguage) land in M6; for now
// the rows display the active values from the store. The Developer row (dev
// builds only) opens the crypto self-test — the M1 on-device acceptance gate.
export function useSettingsLogic() {
  const accent = useAppSelector((state) => state.settings.accent);
  const language = useAppSelector((state) => state.settings.language);
  const router = useRouter();

  const showDeveloper = __DEV__;
  const openCryptoSelfTest = useCallback(() => {
    router.push("/dev/crypto-selftest");
  }, [router]);

  return { accent, language, showDeveloper, openCryptoSelfTest };
}
