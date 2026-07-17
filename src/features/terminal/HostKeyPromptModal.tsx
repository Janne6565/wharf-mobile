import { ShieldAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, Sheet } from "@/components";
import { colors } from "@/theme/colors";
import type { SshHostKeyPromptEvent } from "../../../modules/wharf-ssh";

// TOFU host-key confirmation sheet: host, key type, SHA256 fingerprint, and a
// warning. Declining ends the flow (the engine rejects with host_key_rejected).
interface HostKeyPromptModalProps {
  readonly prompt: SshHostKeyPromptEvent | null;
  readonly onAccept: () => void;
  readonly onDecline: () => void;
}

function DetailLine({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View className="flex-row items-center justify-between py-1.5">
      <Text className="text-[13px] text-muted">{label}</Text>
      <Text className="font-mono text-[13px] text-fg">{value}</Text>
    </View>
  );
}

export function HostKeyPromptModal({ prompt, onAccept, onDecline }: HostKeyPromptModalProps) {
  const { t } = useTranslation();
  return (
    <Sheet visible={prompt !== null} onClose={onDecline} testID="terminal-hostkey-sheet">
      {prompt ? (
        <View>
          <View className="mb-3 flex-row items-center gap-2">
            <ShieldAlert size={20} color={colors.warn} />
            <Text className="text-lg font-semibold text-fg">{t("terminal.hostKey.title")}</Text>
          </View>
          <Text className="mb-4 text-[13px] leading-5 text-muted">
            {t("terminal.hostKey.warning", { host: prompt.host })}
          </Text>
          <View className="rounded-field border border-borderSoft bg-surface px-3.5 py-2">
            <DetailLine label={t("terminal.hostKey.host")} value={prompt.host} />
            <DetailLine label={t("terminal.hostKey.keyType")} value={prompt.keyType} />
          </View>
          <Text className="mb-1 mt-4 text-xs font-semibold uppercase tracking-widest text-muted">
            {t("terminal.hostKey.fingerprint")}
          </Text>
          <Text className="font-mono text-[13px] text-fgSoft" selectable>
            {prompt.fingerprint}
          </Text>
          <View className="mt-5 gap-2.5">
            <Button
              label={t("terminal.hostKey.accept")}
              variant="accent"
              onPress={onAccept}
              testID="terminal-hostkey-accept"
            />
            <Button
              label={t("terminal.hostKey.decline")}
              variant="outline"
              onPress={onDecline}
              testID="terminal-hostkey-decline"
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}
