import { Tabs } from "expo-router";
import { KeyRound, LayoutGrid, Settings, TerminalSquare } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { TabBarGlassBackground } from "@/components";
import { SyncConflictSheet } from "@/features/syncConflict";
import { useSyncEngine } from "@/hooks/useSyncEngine";
import { liquidGlassAvailable } from "@/lib/liquidGlass";
import { colors } from "@/theme/colors";
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
  borderTopColor: colors.borderSoft,
};

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
            tabBarIcon: ({ color, size }) => <TerminalSquare color={color} size={size} />,
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
            tabBarIcon: ({ color, size }) => <Settings color={color} size={size} />,
          }}
        />
      </Tabs>
      <SyncConflictSheet />
    </Fragment>
  );
}
