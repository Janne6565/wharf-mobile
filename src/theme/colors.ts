// Runtime mirror of the Tailwind theme tokens (tailwind.config.js). Components
// style with NativeWind `className` tokens wherever possible; this object exists
// for the few APIs that take a colour value rather than a class — chiefly
// lucide-react-native icon `color` props and native config (nav/status bar).
// Keep the two in sync: a change here must match tailwind.config.js.
export const colors = {
  shell: "#0A0F15",
  shellTop: "#0D141D",
  shellRaised: "#0B1119",
  term: "#06090E",
  card: "#111822",
  cardTop: "#141C26",
  surface: "#121A24",
  raised: "#18222E",
  raisedDeep: "#131C26",
  chip: "#17202B",
  avatar: "#1B2530",
  well: "#0A1017",
  border: "#223140",
  borderStrong: "#26343F",
  borderInput: "#1D2833",
  borderSoft: "#1C2733",
  borderFaint: "#1B2530",
  termBorder: "#17202B",
  fg: "#EAF0F5",
  fgSoft: "#BFCBD6",
  muted: "#5A6B77",
  dim: "#8FA0AC",
  faint: "#3D4A57",
  ink: "#08110F",
  accent: "#57D7C2",
  accentBlue: "#6FB3E8",
  accentPurple: "#C983E8",
  accentAmber: "#FFC86B",
  ok: "#69D26E",
  warn: "#E3C078",
  danger: "#E5484D",
} as const;

export type ColorToken = keyof typeof colors;
