import { LinearGradient } from "expo-linear-gradient";
import { Plus } from "lucide-react-native";
import { Pressable, StyleSheet } from "react-native";
import { colors } from "@/theme/colors";
import { ADD_BUTTON_SHADOW } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";

interface AddButtonProps {
  readonly onPress: () => void;
  readonly testID?: string;
}

// The circular add affordance from the Hosts header (v2): a raised gradient disc
// with a soft drop shadow and the accent-tinted plus. Opens the add-host form.
export function AddButton({ onPress, testID }: AddButtonProps) {
  const accent = useAccentColor();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      style={{ boxShadow: ADD_BUTTON_SHADOW }}
      className="h-[38px] w-[38px] items-center justify-center overflow-hidden rounded-full border border-borderStrong"
    >
      <LinearGradient colors={[colors.raised, colors.raisedDeep]} style={StyleSheet.absoluteFill} />
      <Plus size={22} color={accent} strokeWidth={1.5} />
    </Pressable>
  );
}
