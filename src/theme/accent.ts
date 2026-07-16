import { vars } from "nativewind";
import type { AccentColor } from "@/store/settingsSlice";

// The accent token is the one theme colour the user can switch at runtime. Rather
// than rebuild the theme system, we wire a SINGLE NativeWind CSS variable
// (`--color-accent`) that the Tailwind `accent` colour resolves through
// (`rgb(var(--color-accent) / <alpha-value>)`). `accentVars()` produces the style
// object that redefines the variable for a subtree; `<AccentProvider>` applies it
// at the app root from the persisted Redux value. Class-based accents
// (`text-accent`, `bg-accent`) follow automatically; the few JS colour props that
// take a hex read `useAccentColor()` instead.

// Converts a #RRGGBB hex to the space-separated "R G B" channel triple that
// `rgb(var(--x) / <alpha>)` expects.
export function hexToRgbTriple(hex: string): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `${r} ${g} ${b}`;
}

// The NativeWind `vars()` style that rebinds the accent variable for a subtree.
export function accentVars(accent: AccentColor) {
  return vars({ "--color-accent": hexToRgbTriple(accent) });
}
