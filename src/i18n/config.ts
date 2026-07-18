import AsyncStorage from "@react-native-async-storage/async-storage";
import i18n from "i18next";
import { initReactI18next } from "react-i18next";
import { store } from "@/store";
import { setLanguage } from "@/store/settingsSlice";
import { type AppLanguage, defaultNS, resources } from "./resources";

// Persisted under an app-prefixed key. On native there is no synchronous storage,
// so i18n initialises with the fallback and `loadPersistedLanguage()` hydrates the
// stored choice on app start (called from the root layout before the splash gate
// lifts).
export const STORAGE_KEY = "wharf-mobile-language";
const FALLBACK: AppLanguage = "en";

function isSupported(value: string | null): value is AppLanguage {
  return value !== null && value in resources;
}

if (!i18n.isInitialized) {
  void i18n.use(initReactI18next).init({
    resources,
    defaultNS,
    lng: FALLBACK,
    fallbackLng: FALLBACK,
    interpolation: { escapeValue: false },
  });
}

// Reads the persisted language and applies it. Swallows storage errors so a
// storage failure degrades to the fallback rather than crashing startup.
export async function loadPersistedLanguage(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(STORAGE_KEY);
    if (isSupported(stored)) {
      store.dispatch(setLanguage(stored));
      if (stored !== i18n.language) {
        await i18n.changeLanguage(stored);
      }
    }
  } catch {
    // AsyncStorage unavailable — keep the fallback language.
  }
}

// Switches the active language and persists the choice.
export async function persistLanguage(language: AppLanguage): Promise<void> {
  store.dispatch(setLanguage(language));
  await i18n.changeLanguage(language);
  try {
    await AsyncStorage.setItem(STORAGE_KEY, language);
  } catch {
    // Persist failure is non-fatal; the in-memory language still changes.
  }
}

export default i18n;
