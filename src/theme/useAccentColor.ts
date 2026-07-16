import { useAppSelector } from "@/store/hooks";
import type { AccentColor } from "@/store/settingsSlice";

// The current accent as a hex string, for the JS colour props that cannot use a
// `text-accent` class — lucide icon `color`, the tab bar's active tint. Reads the
// same Redux value that `<AccentProvider>` binds to the CSS variable, so icons and
// classes always agree on the active accent.
export function useAccentColor(): AccentColor {
  return useAppSelector((state) => state.settings.accent);
}
