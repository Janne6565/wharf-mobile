import { Pressable, Text, View } from "react-native";
import { ACCENT_OPTIONS, type AccentColor } from "@/store/settingsSlice";

interface ThemeAccentRowProps {
  readonly label: string;
  readonly accent: AccentColor;
  readonly onSelect: (accent: AccentColor) => void;
}

// The accent picker row (mock's Brand control): a label and the row of selectable
// accent swatches. The active swatch gets an accent-tinted ring. Each swatch fills
// with its own literal hex (not the `accent` token) so all options render in their
// true colour regardless of the current selection.
export function ThemeAccentRow({ label, accent, onSelect }: ThemeAccentRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-fg">{label}</Text>
      <View className="flex-row items-center gap-2.5">
        {ACCENT_OPTIONS.map((option) => (
          <Pressable
            key={option}
            onPress={() => onSelect(option)}
            accessibilityRole="button"
            accessibilityState={{ selected: option === accent }}
            testID={`accent-${option}`}
            className="h-6 w-6 items-center justify-center rounded-full"
            style={{
              borderWidth: option === accent ? 2 : 0,
              borderColor: option,
            }}
          >
            <View className="h-4 w-4 rounded-full" style={{ backgroundColor: option }} />
          </Pressable>
        ))}
      </View>
    </View>
  );
}
