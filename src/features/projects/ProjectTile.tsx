import { Text, View } from "react-native";
import { cn } from "@/lib/cn";

interface ProjectTileProps {
  readonly initials: string;
  // "md" (36px) on the projects list; "lg" (44px) in the project detail header.
  readonly size?: "md" | "lg";
}

// The v2 project mark: a rounded square with the accent mono initials on the
// avatar fill. Purely decorative — the adjacent project name is the accessible
// label (like <Avatar>).
export function ProjectTile({ initials, size = "md" }: ProjectTileProps) {
  return (
    <View
      className={cn(
        "items-center justify-center border border-borderStrong bg-avatar",
        size === "md" ? "h-9 w-9 rounded-tile" : "h-11 w-11 rounded-[13px]",
      )}
    >
      <Text
        className={cn("font-mono-bold text-accent", size === "md" ? "text-[12px]" : "text-[14px]")}
      >
        {initials}
      </Text>
    </View>
  );
}
