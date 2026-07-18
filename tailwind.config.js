/**
 * Tailwind theme for Wharf mobile. Tokens are extracted verbatim from the design
 * mock (`design/Wharf Mobile v2.dc.html`): shifted dark-navy shell, gradient
 * surfaces, glow language, mono type, teal accent with three alternates.
 * Semantic names only — components reference `bg-card`, `text-muted`,
 * `border-borderSoft`, never raw hex.
 *
 * NOTE: this palette is mirrored at runtime in src/theme/colors.ts — any change
 * here MUST be reflected there (hard rule; the two files must stay in sync).
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        shell: "#0A0F15", // app bg / screen-gradient bottom
        shellTop: "#0D141D", // screen-gradient top
        shellRaised: "#0B1119", // solid tab bar
        term: "#06090E", // terminal screen bg (Phase B)
        card: "#111822", // card gradient bottom / flat fallback
        cardTop: "#141C26", // card gradient top; terminal keycap fill
        surface: "#121A24", // inputs, search, wells' surroundings
        raised: "#18222E", // button gradient top
        raisedDeep: "#131C26", // button gradient bottom
        chip: "#17202B", // pill chip fill
        avatar: "#1B2530", // avatar circle fill
        well: "#0A1017", // inset code/fingerprint block fill
        border: "#223140", // card outline, standard input outline
        borderStrong: "#26343F", // buttons, avatars, chips outline
        borderInput: "#1D2833", // search field + keycap outline
        borderSoft: "#1C2733", // row dividers
        borderFaint: "#1B2530", // tab-bar top hairline, note cards, well outline
        termBorder: "#17202B", // terminal chrome hairlines (Phase B)
        fg: "#EAF0F5", // primary text
        fgSoft: "#BFCBD6", // secondary body text (terminal, prose)
        muted: "#5A6B77", // labels, sublabels, inactive tabs
        dim: "#8FA0AC", // slightly brighter muted (email button label)
        faint: "#3D4A57", // chevrons, lowest-contrast marks
        ink: "#08110F", // text on accent-filled controls
        // Accent is the one runtime-switchable token: it resolves through a
        // NativeWind CSS variable so the Settings accent picker recolours every
        // `text-accent`/`bg-accent` at once. Default (teal #57D7C2) lives in
        // global.css `:root`; AccentProvider overrides it from the store.
        accent: "rgb(var(--color-accent) / <alpha-value>)", // brand teal (default theme)
        accentBlue: "#6FB3E8", // theme option
        accentPurple: "#C983E8", // theme option
        accentAmber: "#FFC86B", // theme option
        ok: "#69D26E", // reachable status dot / connected
        warn: "#E3C078", // pending / awaiting state
        danger: "#E5484D", // destructive / error
      },
      fontFamily: {
        mono: ["JetBrainsMono_400Regular"],
        "mono-medium": ["JetBrainsMono_500Medium"],
        "mono-bold": ["JetBrainsMono_700Bold"],
      },
      borderRadius: {
        card: "16px",
        field: "13px",
        btn: "15px",
        tile: "11px",
      },
    },
  },
  plugins: [],
};
