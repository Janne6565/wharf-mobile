import { CheckCircle2, Circle, Loader, XCircle } from "lucide-react-native";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import type { CheckResult } from "./useCryptoSelfTestLogic";

const ICON_SIZE = 18;

function StatusIcon({ status }: { readonly status: CheckResult["status"] }) {
  switch (status) {
    case "pass":
      return <CheckCircle2 size={ICON_SIZE} color={colors.ok} aria-hidden />;
    case "fail":
      return <XCircle size={ICON_SIZE} color={colors.danger} aria-hidden />;
    case "running":
      return <Loader size={ICON_SIZE} color={colors.accent} aria-hidden />;
    default:
      return <Circle size={ICON_SIZE} color={colors.faint} aria-hidden />;
  }
}

// One self-test assertion row: status icon, technical check name, and (on
// failure) the mismatch detail.
export function CheckRow({ result }: { readonly result: CheckResult }) {
  return (
    <View className="flex-row items-start gap-3 px-4 py-3">
      <View className="mt-0.5">
        <StatusIcon status={result.status} />
      </View>
      <View className="flex-1">
        <Text className="text-[13px] text-fg">{result.name}</Text>
        {result.status === "fail" && result.detail ? (
          <Text className="mt-1 text-[12px] text-danger">{result.detail}</Text>
        ) : null}
      </View>
    </View>
  );
}
