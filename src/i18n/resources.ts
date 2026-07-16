// Typed translation resources. Per REACT.md these are plain TypeScript objects
// (no JSON, no HTTP) so every key is compile-time checked. `enCommon` is the
// source of truth for the key shape; `de` is typed against it, so a missing or
// mistyped key is a build error, not a runtime surprise.

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
  signIn: {
    // Brand tagline — deliberately untranslated (brand voice).
    tagline: "your fleet, one pocket",
    continueGoogle: "Continue with Google",
    continueGithub: "Continue with GitHub",
    continueEmail: "Continue with email",
    footer: "Your vault is end-to-end encrypted.\nPrivate keys never leave your devices.",
    emailLabel: "Email",
    emailPlaceholder: "you@example.com",
    passwordLabel: "Master password",
    submit: "Sign in",
    back: "Back",
    errors: {
      emailInvalid: "Enter a valid email address.",
      passwordRequired: "Enter your master password.",
      invalidCredentials: "Email or password is incorrect.",
      rateLimited: "Too many attempts. Try again in a moment.",
      generic: "Sign-in failed. Check your connection and try again.",
    },
  },
  pair: {
    title: "Pair this device",
    body: "Sign in at {{host}} in your browser and enter the pairing code shown there.",
    codeLabel: "Pairing code",
    codePlaceholder: "XXXX-XXXX",
    submit: "Pair device",
    back: "Back",
    errors: {
      invalidCode: "That code is invalid or expired.",
      rateLimited: "Too many attempts. Try again in a moment.",
      generic: "Pairing failed. Check your connection and try again.",
    },
  },
  unlock: {
    title: "Unlock vault",
    body: "Enter your master password to decrypt your vault on this device.",
    passwordLabel: "Master password",
    submit: "Unlock",
    biometricButton: "Unlock with biometrics",
    biometricPrompt: "Unlock your Wharf vault",
    enrollTitle: "Enable biometric unlock?",
    enrollBody:
      "Open your vault with Face ID or fingerprint next time. Your key is stored in the device's secure keystore.",
    enrollAccept: "Enable",
    enrollSkip: "Not now",
    signOut: "Sign out",
    noVaultTitle: "No vault yet",
    noVaultBody: "This account has no vault. Finish setting up on the web first.",
    errors: {
      wrongPassword: "Wrong master password.",
      generic: "Unlock failed. Check your connection and try again.",
    },
  },
  hosts: {
    title: "Hosts",
    search: "Search hosts",
    sectionPersonal: "PERSONAL",
    empty: "No hosts yet.",
    emptyBody: "Hosts you add in the terminal or on the web appear here after sync.",
    noMatches: "No hosts match your search.",
  },
  hostDetail: {
    back: "Hosts",
    user: "User",
    address: "Address",
    port: "Port",
    tags: "Tags",
    notFound: "Host not found.",
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
    lockVault: "Lock vault",
    signOut: "Sign out",
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
  signIn: {
    tagline: "your fleet, one pocket",
    continueGoogle: "Mit Google fortfahren",
    continueGithub: "Mit GitHub fortfahren",
    continueEmail: "Mit E-Mail fortfahren",
    footer:
      "Dein Tresor ist Ende-zu-Ende-verschlüsselt.\nPrivate Schlüssel verlassen nie deine Geräte.",
    emailLabel: "E-Mail",
    emailPlaceholder: "du@example.com",
    passwordLabel: "Master-Passwort",
    submit: "Anmelden",
    back: "Zurück",
    errors: {
      emailInvalid: "Gib eine gültige E-Mail-Adresse ein.",
      passwordRequired: "Gib dein Master-Passwort ein.",
      invalidCredentials: "E-Mail oder Passwort ist falsch.",
      rateLimited: "Zu viele Versuche. Warte einen Moment.",
      generic: "Anmeldung fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.",
    },
  },
  pair: {
    title: "Dieses Gerät koppeln",
    body: "Melde dich im Browser unter {{host}} an und gib den dort angezeigten Kopplungscode ein.",
    codeLabel: "Kopplungscode",
    codePlaceholder: "XXXX-XXXX",
    submit: "Gerät koppeln",
    back: "Zurück",
    errors: {
      invalidCode: "Dieser Code ist ungültig oder abgelaufen.",
      rateLimited: "Zu viele Versuche. Warte einen Moment.",
      generic: "Kopplung fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.",
    },
  },
  unlock: {
    title: "Tresor entsperren",
    body: "Gib dein Master-Passwort ein, um deinen Tresor auf diesem Gerät zu entschlüsseln.",
    passwordLabel: "Master-Passwort",
    submit: "Entsperren",
    biometricButton: "Mit Biometrie entsperren",
    biometricPrompt: "Wharf-Tresor entsperren",
    enrollTitle: "Biometrisches Entsperren aktivieren?",
    enrollBody:
      "Öffne deinen Tresor beim nächsten Mal mit Face ID oder Fingerabdruck. Dein Schlüssel liegt im sicheren Schlüsselspeicher des Geräts.",
    enrollAccept: "Aktivieren",
    enrollSkip: "Später",
    signOut: "Abmelden",
    noVaultTitle: "Noch kein Tresor",
    noVaultBody: "Dieses Konto hat noch keinen Tresor. Schließe zuerst die Einrichtung im Web ab.",
    errors: {
      wrongPassword: "Falsches Master-Passwort.",
      generic: "Entsperren fehlgeschlagen. Prüfe deine Verbindung und versuche es erneut.",
    },
  },
  hosts: {
    title: "Hosts",
    search: "Hosts suchen",
    sectionPersonal: "PERSÖNLICH",
    empty: "Noch keine Hosts.",
    emptyBody:
      "Hosts, die du im Terminal oder im Web anlegst, erscheinen hier nach der Synchronisierung.",
    noMatches: "Keine Hosts entsprechen deiner Suche.",
  },
  hostDetail: {
    back: "Hosts",
    user: "Benutzer",
    address: "Adresse",
    port: "Port",
    tags: "Tags",
    notFound: "Host nicht gefunden.",
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
    lockVault: "Tresor sperren",
    signOut: "Abmelden",
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
