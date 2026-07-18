import { ChevronRight } from "lucide-react-native";
import type { ReactNode } from "react";
import { Pressable, Text, View } from "react-native";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";

interface SettingsRowProps {
  readonly label: string;
  readonly value?: string;
  readonly onPress?: () => void;
  // Render the value in the mono type family — v2 shows technical values
  // (version, shortcuts) in mono.
  readonly monoValue?: boolean;
  // Show a trailing chevron. Opt-in: a chevron signals navigation to another
  // screen, not merely that the row is tappable (a toggle/action row is
  // pressable but has no chevron).
  readonly chevron?: boolean;
  // Render the label in the danger colour — for destructive actions (sign out).
  readonly danger?: boolean;
  // A trailing control (e.g. a Switch or colour swatches) rendered in place of
  // the chevron. When present the row shows no chevron even if `chevron` is set.
  readonly accessory?: ReactNode;
}

// A single Settings list row: label, optional current value, and an optional
// trailing chevron (navigation), a custom accessory, or nothing. Becomes
// pressable when an `onPress` handler is provided; the chevron is opt-in and
// means "navigates", not merely "tappable".
export function SettingsRow({
  label,
  value,
  onPress,
  monoValue,
  chevron,
  danger,
  accessory,
}: SettingsRowProps) {
  const content = (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className={cn("flex-1 text-[15px]", danger ? "text-danger" : "text-fg")}>{label}</Text>
      {value ? (
        <Text
          numberOfLines={2}
          className={cn(
            "shrink text-right text-muted",
            monoValue ? "font-mono text-[13px]" : "text-[15px]",
          )}
        >
          {value}
        </Text>
      ) : null}
      {accessory ?? (chevron ? <ChevronRight size={20} color={colors.faint} /> : null)}
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
