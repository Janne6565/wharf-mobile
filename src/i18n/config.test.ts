import AsyncStorage from "@react-native-async-storage/async-storage";
import { store } from "@/store";
import { setLanguage } from "@/store/settingsSlice";
import i18n, { loadPersistedLanguage, persistLanguage, STORAGE_KEY } from "./config";

// Regression coverage for the language toggle: the Settings row reads
// `state.settings.language`, so the persistence helpers must mirror the chosen
// language into the store (not just i18next/AsyncStorage).
describe("i18n language persistence", () => {
  beforeEach(async () => {
    await AsyncStorage.clear();
    store.dispatch(setLanguage("en"));
    await i18n.changeLanguage("en");
  });

  it("persistLanguage mirrors the choice into the store, i18n, and storage", async () => {
    await persistLanguage("de");

    expect(store.getState().settings.language).toBe("de");
    expect(i18n.language).toBe("de");
    expect(await AsyncStorage.getItem(STORAGE_KEY)).toBe("de");
  });

  it("loadPersistedLanguage hydrates the store and i18n from a stored language", async () => {
    await AsyncStorage.setItem(STORAGE_KEY, "de");

    await loadPersistedLanguage();

    expect(store.getState().settings.language).toBe("de");
    expect(i18n.language).toBe("de");
  });

  it("loadPersistedLanguage leaves the fallback when nothing is stored", async () => {
    await loadPersistedLanguage();

    expect(store.getState().settings.language).toBe("en");
    expect(i18n.language).toBe("en");
  });
});
