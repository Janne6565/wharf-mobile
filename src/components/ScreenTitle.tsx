import type { ReactNode } from "react";
import { Text, View } from "react-native";

interface ScreenTitleProps {
  readonly title: string;
  readonly action?: ReactNode;
}

// The v2 terminal-prompt screen title: a mono lowercase heading prefixed with an
// accent `❯` prompt. The `❯` glyph is the sanctioned terminal/brand-mark
// exception to REACT.md's lucide-only icon rule. Optional trailing action slot
// (e.g. the circular add button on Hosts).
export function ScreenTitle({ title, action }: ScreenTitleProps) {
  return (
    <View className="min-h-[38px] flex-row items-center">
      <Text className="font-mono-bold text-[26px] lowercase text-fg">
        <Text className="text-accent">❯ </Text>
        {title}
      </Text>
      {action ? <View className="ml-auto">{action}</View> : null}
    </View>
  );
}
