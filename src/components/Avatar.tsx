import { Text, View } from "react-native";

interface AvatarProps {
  readonly initials: string;
}

// The 32px initials avatar from the project mock: rounded fill, accent mono
// initials. Purely decorative — the adjacent name/email is the accessible label.
export function Avatar({ initials }: AvatarProps) {
  return (
    <View className="h-8 w-8 items-center justify-center rounded-full bg-avatar">
      <Text className="font-mono text-[13px] text-accent">{initials}</Text>
    </View>
  );
}
