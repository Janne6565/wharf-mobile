// Availability probe for the iOS 26 "Liquid Glass" design. Lives in `src/lib`
// (normally framework-agnostic) because it wraps a platform capability check, not
// React state — no hooks, no components. `isLiquidGlassAvailable()` reflects the
// OS/SDK the binary is running on; it cannot change while the app is running, so
// this is a module-level `const` evaluated once at import — not a hook. Android/web
// short-circuit on `Platform.OS` so the native check is only reached on iOS.
import { isLiquidGlassAvailable } from "expo-glass-effect";
import { Platform } from "react-native";

export const liquidGlassAvailable: boolean = Platform.OS === "ios" && isLiquidGlassAvailable();
