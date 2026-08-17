import { LinearGradient } from "expo-linear-gradient";
import { BottomTabBarHeightContext } from "expo-router/js-tabs";
import { type ReactNode, useContext } from "react";
import { ScrollView, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";
import { liquidGlassAvailable } from "@/lib/liquidGlass";
import { colors } from "@/theme/colors";

// The v2 header gradient fades shellTop→shell over the top of every screen.
const HEADER_GRADIENT_HEIGHT = 260;

interface ScreenContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
  // Screens that bring their own scroll container (a ScrollView, or any
  // virtualized list) opt out: nesting one inside another breaks scrolling and,
  // for virtualized lists, discards their windowing.
  readonly scrollable?: boolean;
}

// Dark shell wrapper honouring the top safe-area inset.
//
// Content scrolls by default. Every screen here is a column of cards whose
// height depends on how many hosts, keys or projects the user has, so a fixed
// container silently truncates the list as soon as it outgrows the viewport —
// with no affordance, because the rows that fit look complete.
//
// With Liquid Glass the tab bar floats over content, so the bottom padding goes
// on the *scroll content* rather than the outer view: it has to be scrolled
// through, otherwise the last row stops underneath the glass. We read the
// height via the *context* (default `undefined` → 0) rather than
// `useBottomTabBarHeight()`, which throws outside a tab navigator — this
// component is also rendered in tests and non-tab screens. Without glass the
// bar owns the bottom inset as before, so padding stays 0.
export function ScreenContainer({ children, className, scrollable = true }: ScreenContainerProps) {
  const tabBarHeight = useContext(BottomTabBarHeightContext) ?? 0;
  const paddingBottom = liquidGlassAvailable ? tabBarHeight : 0;

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-shell">
      <LinearGradient
        colors={[colors.shellTop, colors.shell]}
        pointerEvents="none"
        style={{ position: "absolute", left: 0, right: 0, top: 0, height: HEADER_GRADIENT_HEIGHT }}
      />
      {scrollable ? (
        <ScrollView
          className="flex-1"
          // flexGrow rather than flex so short screens still fill the viewport
          // (empty states stay vertically placed) while long ones grow past it.
          contentContainerStyle={{ flexGrow: 1, paddingBottom }}
          // Rows and buttons should react to the first tap while the search
          // keyboard is up, instead of spending it on dismissing the keyboard.
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
          testID="screen-scroll"
        >
          {/*
            flexGrow, never `flex-1`: inside a scroll container `flex: 1` also
            sets flex-basis 0 and allows shrinking, so content taller than the
            viewport gets clipped rather than scrolled — the same symptom this
            change exists to fix, just harder to spot.
          */}
          <View className={cn("px-5", className)} style={{ flexGrow: 1 }}>
            {children}
          </View>
        </ScrollView>
      ) : (
        <View className={cn("flex-1 px-5", className)} style={{ paddingBottom }}>
          {children}
        </View>
      )}
    </SafeAreaView>
  );
}
