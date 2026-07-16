import { Text } from "react-native";
import { cn } from "@/lib/cn";

interface RoleChipProps {
  // The already-translated role label ("owner" / "admin" / "member").
  readonly label: string;
  // A pill on the projects list, or plain muted text in the members card (mock).
  readonly variant?: "pill" | "plain";
}

// The member-role indicator. On the list it reads as a subtle pill; in the members
// card the mock renders it as plain right-aligned muted text.
export function RoleChip({ label, variant = "plain" }: RoleChipProps) {
  return (
    <Text
      className={cn(
        "text-[13px] text-muted",
        variant === "pill" && "rounded-field bg-surface px-2 py-0.5 text-xs",
      )}
    >
      {label}
    </Text>
  );
}
