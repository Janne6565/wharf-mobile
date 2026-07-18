import { View } from "react-native";
import { cn } from "@/lib/cn";

// The host reachability shown by the status dot: the three probe outcomes plus
// "unknown" for a host that has not been probed (or whose probe failed to run).
export type HostStatus = "online" | "degraded" | "offline" | "unknown";

interface StatusDotProps {
  readonly status: HostStatus;
}

const DOT_COLOR: Record<HostStatus, string> = {
  online: "bg-ok", // green — reachable within budget
  degraded: "bg-warn", // yellow — reachable but slow (RTT over the degraded threshold)
  offline: "bg-danger", // red — refused / unreachable / timed out
  unknown: "bg-muted", // grey — not yet probed
};

// The 8px status dot from the mock, coloured by the host's probed reachability
// (parity with the wharf-tui probe traffic light).
export function StatusDot({ status }: StatusDotProps) {
  return <View className={cn("h-2 w-2 rounded-full", DOT_COLOR[status])} />;
}
