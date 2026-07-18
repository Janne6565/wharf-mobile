import { Tabs } from "expo-router";
import { KeyRound, LayoutGrid, SlidersHorizontal } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { type ColorValue, Text } from "react-native";
import { TabBarGlassBackground } from "@/components";
import { SyncConflictSheet } from "@/features/syncConflict";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { liquidGlassAvailable } from "@/lib/liquidGlass";
import { colors } from "@/theme/colors";
import { hexToRgba } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";

// With Liquid Glass the bar floats over content on a transparent, borderless
// surface backed by <TabBarGlassBackground>; otherwise it keeps the solid dark
// shell. `as const` pins `position` to the ViewStyle literal.
const glassTabBarStyle = {
  position: "absolute",
  backgroundColor: "transparent",
  borderTopWidth: 0,
} as const;
const solidTabBarStyle = {
  backgroundColor: colors.shellRaised,
  borderTopColor: colors.borderFaint,
};

// The Hosts tab uses the wharf brand `❯_` mark instead of a lucide icon — the
// sanctioned terminal/brand-mark glyph exception to REACT.md's icon rule. When
// active (accent tint) it gets an accent-tinted glow.
function HostsTabIcon({
  color,
  focused,
  accent,
}: {
  readonly color: ColorValue;
  readonly focused: boolean;
  readonly accent: string;
}) {
  return (
    <Text
      style={{
        fontFamily: "JetBrainsMono_700Bold",
        fontSize: 15,
        color,
        ...(focused
          ? {
              textShadowColor: hexToRgba(accent, 0.55),
              textShadowOffset: { width: 0, height: 0 },
              textShadowRadius: 6,
            }
          : null),
      }}
    >
      ❯_
    </Text>
  );
}

// The 4-tab bar from the mock: accent-tinted active state on the dark shell.
// The tabs render only while the vault is unlocked, so this is also where the
// sync engine's lifecycle (triggers + initial pass) is owned, and where the
// conflict sheet overlays whichever tab is active.
export default function TabsLayout() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  useSyncEngine();

  return (
    <Fragment>
      <Tabs
        screenOptions={{
          headerShown: false,
          tabBarActiveTintColor: accent,
          tabBarInactiveTintColor: colors.muted,
          tabBarStyle: liquidGlassAvailable ? glassTabBarStyle : solidTabBarStyle,
          tabBarBackground: liquidGlassAvailable ? () => <TabBarGlassBackground /> : undefined,
          tabBarLabelStyle: { fontSize: 10, fontWeight: "600" },
        }}
      >
        <Tabs.Screen
          name="hosts"
          options={{
            title: t("tabs.hosts"),
            tabBarIcon: ({ color, focused }) => (
              <HostsTabIcon color={color} focused={focused} accent={accent} />
            ),
          }}
        />
        <Tabs.Screen
          name="projects"
          options={{
            title: t("tabs.projects"),
            tabBarIcon: ({ color, size }) => <LayoutGrid color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="keys"
          options={{
            title: t("tabs.keys"),
            tabBarIcon: ({ color, size }) => <KeyRound color={color} size={size} />,
          }}
        />
        <Tabs.Screen
          name="settings"
          options={{
            title: t("tabs.settings"),
            tabBarIcon: ({ color, size }) => <SlidersHorizontal color={color} size={size} />,
          }}
        />
      </Tabs>
      <SyncConflictSheet />
    </Fragment>
  );
}
