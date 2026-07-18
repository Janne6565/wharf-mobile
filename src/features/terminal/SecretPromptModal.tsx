import { Check } from "lucide-react-native";
import { useEffect, useState } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Button, FormField, Sheet } from "@/components";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";
import type { SshSecretPromptEvent } from "../../../modules/wharf-ssh";

// Secret-entry sheet for a password / keyboard-interactive challenge. Retry copy
// distinguishes a rejected password; "remember this password" is offered only for
// password prompts (never keyboard-interactive) and only when the host can persist
// it (`canRemember`). Both personal and project hosts can now persist — the hook
// passes `canRemember` true for a password prompt on either — but the prop stays
// wired so the modal keeps documenting the single gate point (e.g. ki prompts, or a
// future host kind that cannot remember). Cancelling resolves the prompt with null.
interface SecretPromptModalProps {
  readonly prompt: SshSecretPromptEvent | null;
  readonly canRemember: boolean;
  readonly onSubmit: (secret: string, remember: boolean) => void;
  readonly onCancel: () => void;
}

function RememberToggle({
  checked,
  onToggle,
  label,
}: {
  readonly checked: boolean;
  readonly onToggle: () => void;
  readonly label: string;
}) {
  return (
    <Pressable
      accessibilityRole="checkbox"
      accessibilityState={{ checked }}
      onPress={onToggle}
      testID="terminal-secret-remember"
      className="mt-3 flex-row items-center gap-2.5 py-1"
    >
      <View
        className={cn(
          "h-5 w-5 items-center justify-center rounded border",
          checked ? "border-accent bg-accent" : "border-border bg-surface",
        )}
      >
        {checked ? <Check size={14} color={colors.shell} /> : null}
      </View>
      <Text className="text-[14px] text-fgSoft">{label}</Text>
    </Pressable>
  );
}

export function SecretPromptModal({
  prompt,
  canRemember,
  onSubmit,
  onCancel,
}: SecretPromptModalProps) {
  const { t } = useTranslation();
  const [secret, setSecret] = useState("");
  const [remember, setRemember] = useState(false);

  // Reset the fields whenever a new prompt arrives (keyed on promptId).
  // biome-ignore lint/correctness/useExhaustiveDependencies: promptId is the intentional reset trigger, not a value read in the effect.
  useEffect(() => {
    setSecret("");
    setRemember(false);
  }, [prompt?.promptId]);

  const isKi = prompt?.kind === "ki";
  const isRetry = prompt?.kind === "password_retry";
  const title = isKi ? t("terminal.secret.kiTitle") : t("terminal.secret.passwordTitle");
  const message = isKi
    ? prompt?.prompt
    : isRetry
      ? t("terminal.secret.passwordRetry")
      : t("terminal.secret.passwordBody");

  return (
    <Sheet visible={prompt !== null} onClose={onCancel} testID="terminal-secret-sheet">
      {prompt ? (
        <View>
          <Text className="mb-1 text-lg font-semibold text-fg">{title}</Text>
          {message ? (
            <Text className="mb-4 text-[13px] leading-5 text-muted">{message}</Text>
          ) : null}
          <FormField
            label={isKi ? t("terminal.secret.responseLabel") : t("terminal.secret.passwordLabel")}
            value={secret}
            onChangeText={setSecret}
            secureTextEntry={isKi ? !prompt.echo : true}
            autoCapitalize="none"
            autoCorrect={false}
            onSubmitEditing={() => onSubmit(secret, remember)}
            testID="terminal-secret-input"
          />
          {!isKi && canRemember ? (
            <RememberToggle
              checked={remember}
              onToggle={() => setRemember((value) => !value)}
              label={t("terminal.secret.remember")}
            />
          ) : null}
          <View className="mt-5 gap-2.5">
            <Button
              label={t("terminal.secret.submit")}
              variant="accent"
              onPress={() => onSubmit(secret, remember)}
              testID="terminal-secret-submit"
            />
            <Button
              label={t("terminal.secret.cancel")}
              variant="outline"
              onPress={onCancel}
              testID="terminal-secret-cancel"
            />
          </View>
        </View>
      ) : null}
    </Sheet>
  );
}
