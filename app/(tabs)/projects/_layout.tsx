import { Stack } from "expo-router";
import { colors } from "@/theme/colors";

// Stack inside the Projects tab: the list (index) and the project detail
// ([projectId]). Headers are custom-rendered by the screens themselves.
export default function ProjectsStackLayout() {
  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.shell },
      }}
    />
  );
}
