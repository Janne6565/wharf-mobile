import reducer, {
  type AccentColor,
  DEFAULT_ACCENT,
  DEFAULT_LANGUAGE,
  type SettingsState,
  setAccent,
  setLanguage,
} from "./settingsSlice";

describe("settingsSlice", () => {
  const initial: SettingsState = { accent: DEFAULT_ACCENT, language: DEFAULT_LANGUAGE };

  it("returns the default state", () => {
    expect(reducer(undefined, { type: "@@INIT" })).toEqual(initial);
  });

  it("sets the accent colour", () => {
    const next: AccentColor = "#C983E8";
    expect(reducer(initial, setAccent(next)).accent).toBe(next);
  });

  it("sets the language", () => {
    expect(reducer(initial, setLanguage("de")).language).toBe("de");
  });

  it("leaves the other field untouched when one changes", () => {
    const afterAccent = reducer(initial, setAccent("#6FB3E8"));
    expect(afterAccent.language).toBe(DEFAULT_LANGUAGE);
  });
});
