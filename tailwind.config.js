/**
 * Tailwind theme for Wharf mobile. Tokens are extracted verbatim from the design
 * mock (`design/Wharf Mobile.dc.html`): dark shell, mono type, teal accent with
 * three alternates. Semantic names only — components reference `bg-card`,
 * `text-muted`, `border-borderSoft`, never raw hex.
 *
 * @type {import('tailwindcss').Config}
 */
module.exports = {
  content: ["./app/**/*.{ts,tsx}", "./src/**/*.{ts,tsx}"],
  presets: [require("nativewind/preset")],
  theme: {
    extend: {
      colors: {
        shell: "#0A0E13", // app background
        shellRaised: "#0C1219", // tab bar / raised chrome
        card: "#10161D", // grouped list cards
        surface: "#141B23", // buttons, inputs, avatars fill
        avatar: "#1B2530", // avatar circle fill
        border: "#233140", // primary hairline / control border
        borderSoft: "#1A232D", // row dividers
        fg: "#E8EDF2", // primary text
        fgSoft: "#BCC8D2", // secondary body text (terminal, prose)
        muted: "#54646F", // labels, sublabels, inactive tabs
        dim: "#8B99A5", // slightly brighter muted (email button label)
        faint: "#3A4754", // chevrons, lowest-contrast marks
        accent: "#57D7C2", // brand teal (default theme)
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
        card: "14px",
        field: "12px",
      },
    },
  },
  plugins: [],
};
