import { GlassView } from "expo-glass-effect";
import { StyleSheet } from "react-native";

// The `tabBarBackground` for the tabs when Liquid Glass is available: a system
// glass layer filling the (absolutely-positioned) tab bar. `absoluteFill` is a
// runtime/native style value, so `style` is used rather than a Tailwind class.
export function TabBarGlassBackground() {
  return <GlassView style={StyleSheet.absoluteFill} glassEffectStyle="regular" />;
}
