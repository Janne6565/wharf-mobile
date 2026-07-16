import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface SettingsRowProps {
  readonly label: string;
  readonly value?: string;
  readonly onPress?: () => void;
  // A trailing control (e.g. a Switch or colour swatches) rendered in place of
  // the chevron. When present the row shows no chevron even if pressable.
  readonly accessory?: ReactNode;
}

// A single Settings list row: label, optional current value, and either a
// trailing chevron (navigation), a custom accessory, or nothing. Becomes
// pressable when an `onPress` handler is provided.
export function SettingsRow({ label, value, onPress, accessory }: SettingsRowProps) {
  const content = (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-fg">{label}</Text>
      {value ? <Text className="text-[15px] text-muted">{value}</Text> : null}
      {accessory ?? (onPress ? <ChevronRight size={20} color={colors.faint} /> : null)}
    </View>
  );
  if (onPress) {
    return (
      <Pressable onPress={onPress} accessibilityRole="button">
        {content}
      </Pressable>
    );
  }
  return content;
}
