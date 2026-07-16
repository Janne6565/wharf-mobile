import { View } from "react-native";
import { cn } from "@/lib/cn";

export type HostStatus = "reachable" | "unknown";

interface StatusDotProps {
  readonly status: HostStatus;
}

// The 8px status dot from the mock: green when reachable, muted-grey otherwise.
export function StatusDot({ status }: StatusDotProps) {
  return (
    <View className={cn("h-2 w-2 rounded-full", status === "reachable" ? "bg-ok" : "bg-muted")} />
  );
}
