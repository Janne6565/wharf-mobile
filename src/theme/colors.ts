// Runtime mirror of the Tailwind theme tokens (tailwind.config.js). Components
// style with NativeWind `className` tokens wherever possible; this object exists
// for the few APIs that take a colour value rather than a class — chiefly
// lucide-react-native icon `color` props and native config (nav/status bar).
// Keep the two in sync: a change here must match tailwind.config.js.
export const colors = {
  shell: "#0A0E13",
  shellRaised: "#0C1219",
  card: "#10161D",
  surface: "#141B23",
  avatar: "#1B2530",
  border: "#233140",
  borderSoft: "#1A232D",
  fg: "#E8EDF2",
  fgSoft: "#BCC8D2",
  muted: "#54646F",
  dim: "#8B99A5",
  faint: "#3A4754",
  accent: "#57D7C2",
  accentBlue: "#6FB3E8",
  accentPurple: "#C983E8",
  accentAmber: "#FFC86B",
  ok: "#69D26E",
  warn: "#E3C078",
  danger: "#E5484D",
} as const;

export type ColorToken = keyof typeof colors;
