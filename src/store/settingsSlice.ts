import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { AppLanguage } from "@/i18n/resources";

// The four accent options from the design mock's Brand control. `accent` is the
// default teal; the rest are user-selectable themes (applied dynamically in M6).
export const ACCENT_OPTIONS = ["#57D7C2", "#6FB3E8", "#C983E8", "#FFC86B"] as const;
export type AccentColor = (typeof ACCENT_OPTIONS)[number];

export const DEFAULT_ACCENT: AccentColor = "#57D7C2";
export const DEFAULT_LANGUAGE: AppLanguage = "en";

export interface SettingsState {
  readonly accent: AccentColor;
  readonly language: AppLanguage;
}

const initialState: SettingsState = {
  accent: DEFAULT_ACCENT,
  language: DEFAULT_LANGUAGE,
};

const settingsSlice = createSlice({
  name: "settings",
  initialState,
  reducers: {
    setAccent(state, action: PayloadAction<AccentColor>) {
      state.accent = action.payload;
    },
    setLanguage(state, action: PayloadAction<AppLanguage>) {
      state.language = action.payload;
    },
  },
});

export const { setAccent, setLanguage } = settingsSlice.actions;
export default settingsSlice.reducer;
