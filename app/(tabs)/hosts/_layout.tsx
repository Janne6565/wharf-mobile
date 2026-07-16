import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

// Stack inside the Hosts tab: the list (index) and the read-only host detail.
// Headers are custom-rendered by the screens themselves.
export default function HostsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.shell },
      }}
    />
  );
}
