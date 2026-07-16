import { ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface SettingsRowProps {
  readonly label: string;
  readonly value?: string;
}

// A single Settings list row: label, optional current value, trailing chevron.
// Static in M0.
export function SettingsRow({ label, value }: SettingsRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-fg">{label}</Text>
      {value ? <Text className="text-[15px] text-muted">{value}</Text> : null}
      <ChevronRight size={20} color={colors.faint} />
    </View>
  );
}
