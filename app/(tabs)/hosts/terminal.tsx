import { ChevronLeft, X } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import {
  ActivityIndicator,
  KeyboardAvoidingView,
  Platform,
  Pressable,
  Text,
  View,
} from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components";
import {
  HostKeyPromptModal,
  KeyAccessoryRow,
  SecretPromptModal,
  TerminalView,
  useTerminalLogic,
} from "@/features/terminal";
import type { TerminalPhase } from "@/features/terminal/useTerminalLogic";
import { colors } from "@/theme/colors";
import { useAccentColor } from "@/theme/useAccentColor";
import type { SshErrorCode } from "../../../modules/wharf-ssh";

function StatusLine({
  phase,
  endedError,
}: {
  readonly phase: TerminalPhase;
  readonly endedError: SshErrorCode | null;
}) {
  const { t } = useTranslation();
  const dot = phase === "connected" ? colors.ok : phase === "ended" ? colors.danger : colors.warn;
  const label =
    phase === "connected"
      ? t("terminal.status.connected")
      : phase === "connecting"
        ? t("terminal.status.connecting")
        : endedError
          ? t(`terminal.errors.${endedError}`)
          : t("terminal.status.ended");
  return (
    <View className="flex-row items-center justify-center gap-1.5">
      <View className="h-1.5 w-1.5 rounded-full" style={{ backgroundColor: dot }} />
      <Text className="text-[11px] text-muted">{label}</Text>
    </View>
  );
}

function Overlay({
  phase,
  endedError,
  onReconnect,
}: {
  readonly phase: TerminalPhase;
  readonly endedError: SshErrorCode | null;
  readonly onReconnect: () => void;
}) {
  const { t } = useTranslation();
  if (phase === "connecting") {
    return (
      <View className="absolute inset-0 items-center justify-center bg-shell/80">
        <ActivityIndicator color={colors.accent} />
        <Text className="mt-3 text-sm text-muted">{t("terminal.status.connecting")}</Text>
      </View>
    );
  }
  if (phase === "ended") {
    return (
      <View className="absolute inset-0 items-center justify-center bg-shell/90 px-8">
        <Text className="text-center text-base font-semibold text-fg">
          {endedError ? t(`terminal.errors.${endedError}`) : t("terminal.ended.clean")}
        </Text>
        <View className="mt-5 w-full max-w-[240px]">
          <Button label={t("terminal.ended.reconnect")} variant="accent" onPress={onReconnect} />
        </View>
      </View>
    );
  }
  return null;
}

export default function TerminalScreen() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const logic = useTerminalLogic();

  return (
    <SafeAreaView edges={["top"]} className="flex-1 bg-term">
      <View className="flex-row items-center border-b border-termBorder bg-shell px-3 py-2.5">
        <Pressable onPress={logic.close} accessibilityRole="button" testID="terminal-back">
          <ChevronLeft size={26} color={accent} />
        </Pressable>
        <View className="flex-1">
          <Text
            className="text-center font-mono text-[15px] font-semibold text-fg"
            numberOfLines={1}
          >
            {logic.hostName || t("terminal.status.connecting")}
          </Text>
          <StatusLine phase={logic.phase} endedError={logic.endedError} />
        </View>
        <Pressable onPress={logic.close} accessibilityRole="button" testID="terminal-close">
          <X size={22} color={colors.muted} />
        </Pressable>
      </View>

      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1">
          {logic.htmlUri ? (
            <TerminalView
              ref={logic.termRef}
              htmlUri={logic.htmlUri}
              accent={logic.accent}
              onOutbound={logic.onOutbound}
            />
          ) : null}
          <Overlay
            phase={logic.phase}
            endedError={logic.endedError}
            onReconnect={logic.reconnect}
          />
        </View>
        <KeyAccessoryRow
          modifiers={logic.modifiers}
          onKey={logic.onAccessoryKey}
          onModifier={logic.onModifierKey}
        />
      </KeyboardAvoidingView>

      <HostKeyPromptModal
        prompt={logic.hostKeyPrompt}
        onAccept={logic.acceptHostKey}
        onDecline={logic.declineHostKey}
      />
      <SecretPromptModal
        prompt={logic.secretPrompt}
        canRemember={logic.canRemember}
        onSubmit={logic.submitSecret}
        onCancel={logic.cancelSecret}
      />
    </SafeAreaView>
  );
}
