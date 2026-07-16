import { Tabs } from "expo-router";
import { KeyRound, LayoutGrid, Settings, TerminalSquare } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { colors } from "@/theme/colors";

// The 4-tab bar from the mock: accent-tinted active state on the dark shell.
export default function TabsLayout() {
  const { t } = useTranslation();

  return (
    <Tabs
      screenOptions={{
        headerShown: false,
        tabBarActiveTintColor: colors.accent,
        tabBarInactiveTintColor: colors.muted,
        tabBarStyle: {
          backgroundColor: colors.shellRaised,
          borderTopColor: colors.borderSoft,
        },
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
  );
}
