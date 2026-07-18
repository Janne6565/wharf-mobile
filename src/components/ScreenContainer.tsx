import { LinearGradient } from "expo-linear-gradient";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { type ReactNode, useContext } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { liquidGlassAvailable } from "@/lib/liquidGlass";
import { colors } from "@/theme/colors";

// The v2 header gradient fades shellTop→shell over the top of every screen.
const HEADER_GRADIENT_HEIGHT = 260;

interface ScreenContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

// Dark shell wrapper honouring the top safe-area inset. With Liquid Glass the tab
// bar floats over content, so we pad the bottom by its height to keep content
// clear of the glass. We read the height via the *context* (default `undefined` →
// 0) rather than `useBottomTabBarHeight()`, which throws outside a tab navigator —
// this component is also rendered in tests and non-tab screens. Without glass the
// bar owns the bottom inset as before, so padding stays 0.
export function ScreenContainer({ children, className }: ScreenContainerProps) {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const paddingBottom = liquidGlassAvailable ? tabBarHeight : 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-shell">
      <LinearGradient
        colors={[colors.shellTop, colors.shell]}
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: HEADER_GRADIENT_HEIGHT }}
      />
      <View className={cn("flex-1 px-5", className)} style={{ paddingBottom }}>
        {children}
      </View>
    </SafeAreaView>
  );
}
