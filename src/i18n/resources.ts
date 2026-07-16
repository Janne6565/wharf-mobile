// Typed translation resources. Per REACT.md these are plain TypeScript objects
// (no JSON, no HTTP) so every key is compile-time checked. `enCommon` is the
// source of truth for the key shape; `de` is typed against it, so a missing or
// mistyped key is a build error, not a runtime surprise. M0 covers only the tab
// labels and the placeholder screens.

const enCommon = {
  app: {
    name: "wharf",
  },
  tabs: {
    hosts: "Hosts",
    projects: "Projects",
    keys: "Keys",
    settings: "Settings",
  },
  hosts: {
    title: "Hosts",
    search: "Search hosts",
    sectionPersonal: "PERSONAL",
  },
  projects: {
    title: "Projects",
    teamFeatureTitle: "Projects are a team feature",
    teamFeatureBody: "Share hosts with teammates once you join or create a project.",
  },
  keys: {
    title: "Keys",
    empty: "Your keys will appear here.",
  },
  settings: {
    title: "Settings",
    theme: "Theme",
    language: "Language",
    about: "About",
    developer: "Developer",
  },
  cryptoSelfTest: {
    title: "Crypto self-test",
    backend: "Primitive backend: {{backend}}",
    running: "Running checks…",
    allPassed: "All checks passed.",
    someFailed: "Some checks failed.",
    argon2Timing: "argon2id (t=3, m=64 MiB, p=4)",
    rerun: "Run again",
  },
} as const;

type DeepStringSchema<T> = {
  [K in keyof T]: T[K] extends string ? string : DeepStringSchema<T[K]>;
};
export type CommonSchema = DeepStringSchema<typeof enCommon>;

const deCommon: CommonSchema = {
  app: {
    name: "wharf",
  },
  tabs: {
    hosts: "Hosts",
    projects: "Projekte",
    keys: "Schlüssel",
    settings: "Einstellungen",
  },
  hosts: {
    title: "Hosts",
    search: "Hosts suchen",
    sectionPersonal: "PERSÖNLICH",
  },
  projects: {
    title: "Projekte",
    teamFeatureTitle: "Projekte sind eine Team-Funktion",
    teamFeatureBody:
      "Teile Hosts mit deinem Team, sobald du einem Projekt beitrittst oder eines erstellst.",
  },
  keys: {
    title: "Schlüssel",
    empty: "Deine Schlüssel erscheinen hier.",
  },
  settings: {
    title: "Einstellungen",
    theme: "Design",
    language: "Sprache",
    about: "Über",
    developer: "Entwickler",
  },
  cryptoSelfTest: {
    title: "Krypto-Selbsttest",
    backend: "Primitiv-Backend: {{backend}}",
    running: "Prüfungen laufen…",
    allPassed: "Alle Prüfungen bestanden.",
    someFailed: "Einige Prüfungen fehlgeschlagen.",
    argon2Timing: "argon2id (t=3, m=64 MiB, p=4)",
    rerun: "Erneut ausführen",
  },
};

export const defaultNS = "common";
export const resources = {
  en: { common: enCommon },
  de: { common: deCommon },
} as const;

export type AppLanguage = keyof typeof resources;
