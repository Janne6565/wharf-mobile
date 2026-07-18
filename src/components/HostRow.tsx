import { ChevronRight } from "lucide-react-native";
import { Pressable, Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { type HostStatus, StatusDot } from "./StatusDot";

interface HostRowProps {
  readonly name: string;
  readonly target: string;
  readonly status: HostStatus;
  // The last measured round-trip time (ms). Shown inline for reachable hosts
  // (online/degraded) per the v2 hosts list.
  readonly rttMs?: number;
  readonly onPress?: () => void;
}

// A single host row from the Hosts mock: status dot, mono name, user@host:port
// sublabel, optional inline RTT, trailing chevron. Pressable when the owning
// screen provides a handler (navigates to the host detail).
export function HostRow({ name, target, status, rttMs, onPress }: HostRowProps) {
  const showRtt = (status === "online" || status === "degraded") && typeof rttMs === "number";
  const content = (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <StatusDot status={status} />
      <View className="min-w-0 flex-1">
        <Text className="font-mono text-[15px] text-fg">{name}</Text>
        <Text className="mt-px text-xs text-muted">{target}</Text>
      </View>
      {showRtt ? <Text className="font-mono text-[11px] text-muted">{rttMs}ms</Text> : null}
      <ChevronRight size={20} color={colors.faint} />
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
