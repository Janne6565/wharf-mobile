import Constants from "expo-constants";
import { useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";
import { clearSession } from "@/auth/session";
import { persistLanguage } from "@/i18n/config";
import type { AppLanguage } from "@/i18n/resources";
import { useAppSelector } from "@/store/hooks";
import type { AccentColor } from "@/store/settingsSlice";
import { persistAccent } from "@/theme/accentStorage";
import { lockVault } from "@/vault/unlock";
import { useAccountInfo } from "./useAccountInfo";

// The two languages the app ships; the Language row cycles between them.
const LANGUAGES: readonly AppLanguage[] = ["en", "de"];

export interface SignOutConfirmCopy {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly cancel: string;
}

// Surfaces every Settings value + action for the screen: the accent picker
// (persisted), the language toggle (persisted), the account info, and the session
// actions (lock, sign out with a confirm). Biometrics live in their own hook; the
// Developer row (dev builds only) opens the crypto self-test. Per REACT.md all the
// state/effects/selectors are here so the screen stays thin JSX.
export function useSettingsLogic() {
  const accent = useAppSelector((state) => state.settings.accent);
  const language = useAppSelector((state) => state.settings.language);
  const router = useRouter();
  const account = useAccountInfo();

  const selectAccent = useCallback((next: AccentColor) => {
    void persistAccent(next);
  }, []);

  // Only two languages ship, so the row toggles rather than opening a picker.
  const toggleLanguage = useCallback(() => {
    const next = LANGUAGES[(LANGUAGES.indexOf(language) + 1) % LANGUAGES.length];
    void persistLanguage(next);
  }, [language]);

  const showDeveloper = __DEV__;
  const openCryptoSelfTest = useCallback(() => {
    router.push("/dev/crypto-selftest");
  }, [router]);

  const lock = useCallback(() => {
    lockVault();
  }, []);

  // Sign out is destructive-adjacent (needs a re-pair to sync), so it confirms.
  // The copy is passed in from the screen, which owns t().
  const requestSignOut = useCallback((copy: SignOutConfirmCopy) => {
    Alert.alert(copy.title, copy.body, [
      { text: copy.cancel, style: "cancel" },
      { text: copy.confirm, style: "destructive", onPress: () => void clearSession() },
    ]);
  }, []);

  return {
    accent,
    selectAccent,
    language,
    toggleLanguage,
    account,
    showDeveloper,
    openCryptoSelfTest,
    lock,
    requestSignOut,
    version: Constants.expoConfig?.version ?? "—",
  };
}
