import { useAppSelector } from "@/store/hooks";

// Surfaces the current settings values for the static Settings rows. Theme and
// language pickers (which dispatch setAccent/persistLanguage) land in M6; for now
// the rows display the active values from the store.
export function useSettingsLogic() {
  const accent = useAppSelector((state) => state.settings.accent);
  const language = useAppSelector((state) => state.settings.language);
  return { accent, language };
}
