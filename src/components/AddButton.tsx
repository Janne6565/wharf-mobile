import { Plus } from "lucide-react-native";
import { Pressable } from "react-native";
import { useAccentColor } from "@/theme/useAccentColor";

interface AddButtonProps {
  readonly onPress: () => void;
  readonly testID?: string;
}

// The circular add affordance from the Hosts header — opens the add-host form.
export function AddButton({ onPress, testID }: AddButtonProps) {
  const accent = useAccentColor();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      className="h-9 w-9 items-center justify-center rounded-full border border-border bg-surface"
    >
      <Plus size={22} color={accent} strokeWidth={1.5} />
    </Pressable>
  );
}
