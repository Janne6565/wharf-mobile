import { Search } from "lucide-react-native";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";

interface SearchFieldProps {
  readonly placeholder: string;
}

// Static search-field shell from the Hosts mock. Becomes a live TextInput when
// host search lands (M2); M0 renders the resting state only.
export function SearchField({ placeholder }: SearchFieldProps) {
  return (
    <View className="h-10 flex-row items-center gap-2 rounded-field bg-surface px-3.5">
      <Search size={16} color={colors.muted} />
      <Text className="text-[15px] text-muted">{placeholder}</Text>
    </View>
  );
}
