import type { ReactNode } from "react";
import { View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { cn } from "@/lib/cn";

interface ScreenContainerProps {
  readonly children: ReactNode;
  readonly className?: string;
}

// Dark shell wrapper honouring the top safe-area inset (the tab bar owns the
// bottom inset). Every tab screen renders inside one.
export function ScreenContainer({ children, className }: ScreenContainerProps) {
  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-shell">
      <View className={cn("flex-1 px-5", className)}>{children}</View>
    </SafeAreaView>
  );
}
