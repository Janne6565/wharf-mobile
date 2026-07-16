import { Plus } from "lucide-react-native";
import { View } from "react-native";
import { colors } from "@/theme/colors";

// The circular add affordance from the Hosts header. Static in M0 (no host form
// until M3); rendered as a non-interactive badge for now.
export function AddButton() {
  return (
    <View className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface">
      <Plus size={22} color={colors.accent} strokeWidth={1.5} />
    </View>
  );
}
