import { Search } from "lucide-react-native";
import { TextInput, View } from "react-native";
import { colors } from "@/theme/colors";

interface SearchFieldProps {
  readonly placeholder: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
}

// Live search field from the Hosts mock: icon + borderless input on the dark
// surface. Controlled by the owning screen's logic hook.
export function SearchField({ placeholder, value, onChangeText }: SearchFieldProps) {
  return (
    <View className="h-10 flex-row items-center gap-2 rounded-field bg-surface px-3.5">
      <Search size={16} color={colors.muted} />
      <TextInput
        className="flex-1 py-0 text-[15px] text-fg"
        value={value}
        onChangeText={onChangeText}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        autoCapitalize="none"
        autoCorrect={false}
        accessibilityRole="search"
      />
    </View>
  );
}
