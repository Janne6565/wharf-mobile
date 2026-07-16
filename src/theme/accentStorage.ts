import AsyncStorage from "@react-native-async-storage/async-storage";
import { store } from "@/store";
import { ACCENT_OPTIONS, type AccentColor, setAccent } from "@/store/settingsSlice";

// The accent is UI state that should survive an app restart, mirroring the
// language persistence in i18n/config.ts. Stored under an app-prefixed key; a
// storage failure degrades to the default accent rather than crashing startup.
export const ACCENT_STORAGE_KEY = "wharf-mobile-accent";

function isAccent(value: string | null): value is AccentColor {
  return value !== null && (ACCENT_OPTIONS as readonly string[]).includes(value);
}

// Hydrates the persisted accent into the store on app start (called before the
// splash gate lifts, alongside the language load).
export async function loadPersistedAccent(): Promise<void> {
  try {
    const stored = await AsyncStorage.getItem(ACCENT_STORAGE_KEY);
    if (isAccent(stored)) {
      store.dispatch(setAccent(stored));
    }
  } catch {
    // AsyncStorage unavailable — keep the default accent.
  }
}

// Applies an accent choice: updates the store immediately, then persists it.
export async function persistAccent(accent: AccentColor): Promise<void> {
  store.dispatch(setAccent(accent));
  try {
    await AsyncStorage.setItem(ACCENT_STORAGE_KEY, accent);
  } catch {
    // Persist failure is non-fatal; the in-memory accent still changes.
  }
}
