import type { ReactNode } from "react";
import { View } from "react-native";
import { cn } from "@/lib/cn";

interface CardProps {
  readonly children: ReactNode;
  readonly className?: string;
}

// Grouped-list card container: dark surface, 14px radius, clips row dividers.
export function Card({ children, className }: CardProps) {
  return <View className={cn("overflow-hidden rounded-card bg-card", className)}>{children}</View>;
}

// Full-width hairline divider inset to align with a row's text (past the dot).
export function RowDivider() {
  return <View className="ml-9 h-px bg-borderSoft" />;
}
