// The v2 "glow" design language, expressed as framework-agnostic helpers and
// constants (no React imports). v2 gives every raised surface depth (a soft drop
// shadow), buttons a subtle top highlight, and status/brand marks an emissive
// halo. These feed the RN 0.86 cross-platform `boxShadow`/`textShadow*` style
// props; keep the string syntax so a single value works on iOS + Android.

// "#RRGGBB" + alpha → "rgba(r, g, b, a)". Used to derive the accent-tinted glow
// colours at runtime, since the accent is switchable and cannot be baked in.
export function hexToRgba(hex: string, alpha: number): string {
  const value = hex.replace("#", "");
  const r = Number.parseInt(value.slice(0, 2), 16);
  const g = Number.parseInt(value.slice(2, 4), 16);
  const b = Number.parseInt(value.slice(4, 6), 16);
  return `rgba(${r}, ${g}, ${b}, ${alpha})`;
}

// Depth shadow under a gradient card.
export const CARD_SHADOW = "0 10px 30px rgba(0, 0, 0, 0.3)";

// Filled button: a hairline top highlight plus a grounding drop shadow.
export const BUTTON_SHADOW =
  "inset 0 1px 0 rgba(255, 255, 255, 0.04), 0 4px 14px rgba(0, 0, 0, 0.25)";

// The circular add button's lighter drop shadow.
export const ADD_BUTTON_SHADOW = "0 4px 12px rgba(0, 0, 0, 0.3)";

// Accent-tinted halo behind a primary (accent-filled) button. Derived from the
// live accent so the glow tracks the user's picked accent colour.
export function accentGlow(accent: string): string {
  return `0 8px 24px ${hexToRgba(accent, 0.28)}`;
}

// The emissive halo around a status dot / brand mark.
export function dotGlow(color: string, alpha = 0.4): string {
  return `0 0 10px 1px ${hexToRgba(color, alpha)}`;
}
