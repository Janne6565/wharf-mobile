import { LinearGradient } from "expo-linear-gradient";
import {
  ActivityIndicator,
  Pressable,
  type StyleProp,
  StyleSheet,
  Text,
  type ViewStyle,
} from "react-native";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";
import { accentGlow, BUTTON_SHADOW, hexToRgba } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";

type ButtonVariant = "filled" | "outline" | "accent" | "danger";
type ButtonSize = "md" | "sm";

interface ButtonProps {
  readonly label: string;
  readonly onPress: () => void;
  readonly variant?: ButtonVariant;
  readonly size?: ButtonSize;
  readonly loading?: boolean;
  readonly disabled?: boolean;
  // A mono-bold mark rendered before the label in the label colour — the `❯_`
  // terminal glyph on the Connect button. Per REACT.md this is the sanctioned
  // brand/terminal-mark exception to the lucide-only icon rule.
  readonly glyph?: string;
  readonly testID?: string;
}

// The v2 action button. Variants: "filled" (raised gradient + border, primary
// label — the Google/GitHub buttons), "outline" (transparent, dim label — the
// email button), "accent" (accent fill + accent glow, ink label — submit
// actions), "danger" (transparent, danger-tinted border + label — destructive
// actions). Size "md" (52px, default) or "sm" (38px, compact). Per REACT.md,
// `loading` disables the control and swaps the label for an inline spinner;
// `disabled` gates on form completeness.
export function Button({
  label,
  onPress,
  variant = "filled",
  size = "md",
  loading = false,
  disabled = false,
  glyph,
  testID,
}: ButtonProps) {
  const accent = useAccentColor();
  const blocked = disabled || loading;

  const labelClass = cn(
    variant === "filled" && "text-fg",
    variant === "outline" && "text-dim",
    variant === "accent" && "text-ink font-bold",
    variant === "danger" && "text-danger font-semibold",
    variant !== "accent" && variant !== "danger" && "font-semibold",
  );

  const style: StyleProp<ViewStyle> = [
    variant === "filled" && { boxShadow: BUTTON_SHADOW },
    variant === "accent" && { boxShadow: accentGlow(accent) },
    variant === "danger" && { borderColor: hexToRgba(colors.danger, 0.3) },
  ];

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled: blocked, busy: loading }}
      onPress={onPress}
      disabled={blocked}
      testID={testID}
      style={style}
      className={cn(
        "flex-row items-center justify-center gap-2 overflow-hidden",
        size === "md" ? "h-[52px] rounded-btn" : "h-[38px] rounded-tile",
        variant === "filled" && "border border-borderStrong",
        variant === "outline" && "border border-border bg-transparent",
        variant === "accent" && "bg-accent",
        variant === "danger" && "border bg-transparent",
        blocked && "opacity-50",
      )}
    >
      {variant === "filled" ? (
        <LinearGradient
          colors={[colors.raised, colors.raisedDeep]}
          style={StyleSheet.absoluteFill}
        />
      ) : null}
      {loading ? (
        <ActivityIndicator color={variant === "accent" ? colors.ink : colors.fg} />
      ) : (
        <>
          {glyph ? (
            <Text
              className={cn(
                "font-mono-bold",
                size === "md" ? "text-base" : "text-[13.5px]",
                labelClass,
              )}
            >
              {glyph}
            </Text>
          ) : null}
          <Text className={cn(size === "md" ? "text-base" : "text-[13.5px]", labelClass)}>
            {label}
          </Text>
        </>
      )}
    </Pressable>
  );
}
