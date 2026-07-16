import { ChevronRight } from "lucide-react-native";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { type HostStatus, StatusDot } from "./StatusDot";

interface HostRowProps {
  readonly name: string;
  readonly target: string;
  readonly status: HostStatus;
}

// A single host row from the Hosts mock: status dot, mono name, user@host:port
// sublabel, trailing chevron. Static in M0 (no press handler yet).
export function HostRow({ name, target, status }: HostRowProps) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <StatusDot status={status} />
      <View className="min-w-0 flex-1">
        <Text className="font-mono text-[15px] text-fg">{name}</Text>
        <Text className="mt-px text-xs text-muted">{target}</Text>
      </View>
      <ChevronRight size={20} color={colors.faint} />
    </View>
  );
}
