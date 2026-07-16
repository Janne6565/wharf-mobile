import { CloudOff, LockKeyhole } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { colors } from "@/theme/colors";
import { useSyncStatusLogic } from "./useSyncStatusLogic";

// A thin status strip shown on the Hosts tab when the vault cannot reach the
// server (offline) or a remote change needs a password unlock to adopt. No-op
// when in sync.
export function SyncStatusBanner() {
  const { t } = useTranslation();
  const kind = useSyncStatusLogic();

  if (!kind) {
    return null;
  }

  const message = kind === "needs-password" ? t("sync.needsPassword") : t("sync.offline");
  const Icon = kind === "needs-password" ? LockKeyhole : CloudOff;

  return (
    <View className="mt-3 flex-row items-center gap-2 rounded-field border border-borderSoft bg-surface px-3 py-2">
      <Icon size={16} color={colors.muted} />
      <Text className="flex-1 text-xs text-muted">{message}</Text>
    </View>
  );
}
