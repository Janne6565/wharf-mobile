import type { ReactNode } from "react";
import { View } from "react-native";
import { useAppSelector } from "@/store/hooks";
import { accentVars } from "./accent";

// Binds the persisted accent to the `--color-accent` CSS variable for the whole
// app subtree, so every `text-accent` / `bg-accent` class recolours the instant
// the user picks a different accent in Settings. Must sit inside the Redux
// Provider; wraps the navigator + toast host at the app root.
export function AccentProvider({ children }: { readonly children: ReactNode }) {
  const accent = useAppSelector((state) => state.settings.accent);
  return <View style={[{ flex: 1 }, accentVars(accent)]}>{children}</View>;
}
