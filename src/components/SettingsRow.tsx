import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface SettingsRowProps {
  readonly label: string;
  readonly value?: string;
  readonly onPress?: () => void;
}

// A single Settings list row: label, optional current value, trailing chevron.
// Becomes pressable when an `onPress` handler is provided.
export function SettingsRow({ label, value, onPress }: SettingsRowProps) {
  const content = (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-fg">{label}</Text>
      {value ? <Text className="text-[15px] text-muted">{value}</Text> : null}
      <ChevronRight size={20} color={colors.faint} />
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
