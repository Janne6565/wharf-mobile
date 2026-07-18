import { LinearGradient } from "expo-linear-gradient";
import type { ReactNode } from "react";
import { StyleSheet, View } from "react-native";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";
import { CARD_SHADOW } from "@/theme/effects";

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

// Grouped-list card container (v2): a vertical cardTop→card gradient behind the
// children, a hairline border, a 16px radius that clips row dividers, and a soft
// depth shadow.
export function Card({ children, className }: CardProps) {
  return (
    <View
      className={cn("overflow-hidden rounded-card border border-border", className)}
      style={{ boxShadow: CARD_SHADOW }}
    >
      <LinearGradient colors={[colors.cardTop, colors.card]} style={StyleSheet.absoluteFill} />
      {children}
    </View>
  );
}

// Full-width hairline divider inset to align with a row's text (past the dot).
export function RowDivider() {
  return <View className="ml-9 h-px bg-borderSoft" />;
}
