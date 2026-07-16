import type { ReactNode } from "react";
import { Text, View } from "react-native";

interface ScreenTitleProps {
  readonly title: string;
  readonly action?: ReactNode;
}

// Large screen title with an optional trailing action (e.g. the circular add
// button on Hosts).
export function ScreenTitle({ title, action }: ScreenTitleProps) {
  return (
    <View className="flex-row items-center">
      <Text className="text-3xl font-bold text-fg">{title}</Text>
      {action ? <View className="ml-auto">{action}</View> : null}
    </View>
  );
}
