import { ActivityIndicator, Pressable, Text } from "react-native";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";

type ButtonVariant = "filled" | "outline" | "accent";

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  readonly testID?: string;
}

// The 52px auth button from the sign-in mock. Variants: "filled" (surface fill +
// border, primary label — the Google/GitHub buttons), "outline" (transparent,
// dim label — the email button), "accent" (accent fill, dark label — submit
// actions). Per REACT.md, `loading` disables the control and swaps the label for
// an inline spinner; `disabled` gates on form completeness.
export function Button({
  label,
  onPress,
  variant = "filled",
  loading = false,
  disabled = false,
  testID,
}: ButtonProps) {
  const blocked = disabled || loading;
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={onPress}
      disabled={blocked}
      testID={testID}
      className={cn(
        "h-[52px] items-center justify-center rounded-[14px]",
        variant === "filled" && "border border-border bg-surface",
        variant === "outline" && "border border-border bg-transparent",
        variant === "accent" && "bg-accent",
        blocked && "opacity-50",
      )}
    >
      {loading ? (
        <ActivityIndicator color={variant === "accent" ? colors.shell : colors.fg} />
      ) : (
        <Text
          className={cn(
            "text-base font-semibold",
            variant === "filled" && "text-fg",
            variant === "outline" && "text-dim",
            variant === "accent" && "text-shell",
          )}
        >
          {label}
        </Text>
      )}
    </Pressable>
  );
}
