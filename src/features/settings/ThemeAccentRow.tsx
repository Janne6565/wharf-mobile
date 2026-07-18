import { Pressable, Text, View } from "react-native";
import { ACCENT_OPTIONS, type AccentColor } from "@/store/settingsSlice";
import { colors } from "@/theme/colors";

interface ThemeAccentRowProps {
  readonly label: string;
  readonly accent: AccentColor;
  readonly onSelect: (accent: AccentColor) => void;
}

// The accent picker row (mock's Accent control): a label and the row of selectable
// accent discs. Each disc fills with its own literal hex (not the `accent` token) so
// all options render in their true colour regardless of the current selection. The
// active disc gets the v2 double ring (a card-coloured gap then an accent halo) via
// a layered boxShadow.
export function ThemeAccentRow({ label, accent, onSelect }: ThemeAccentRowProps) {
  return (
    <View className="flex-row items-center gap-2.5 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-fg">{label}</Text>
      {ACCENT_OPTIONS.map((option) => (
        <Pressable
          key={option}
          onPress={() => onSelect(option)}
          accessibilityRole="button"
          accessibilityState={{ selected: option === accent }}
          testID={`accent-${option}`}
          className="h-5 w-5 rounded-full"
          style={{
            backgroundColor: option,
            boxShadow:
              option === accent ? `0 0 0 2px ${colors.card}, 0 0 0 4px ${option}` : undefined,
          }}
        />
      ))}
    </View>
  );
}
