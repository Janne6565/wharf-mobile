import { Controller } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, FormField, Sheet } from "@/components";
import { useInviteSheetLogic } from "./useInviteSheetLogic";
import type { InviteErrorKind } from "./useProjectDetailLogic";

interface InviteSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly onInvite: (email: string) => void;
  readonly saving: boolean;
  readonly error: InviteErrorKind;
  readonly done: boolean;
  readonly reset: () => void;
}

const ERROR_KEY = {
  conflict: "projectDetail.errors.inviteConflict",
  rateLimited: "projectDetail.errors.inviteRateLimited",
  generic: "projectDetail.errors.inviteFailed",
} as const;

// The invite-member sheet (mock's "+ Invite member" row → this dialog). Renders
// the canonical copy, a validated email field, and the send/cancel actions.
// Submit is gated on a non-empty email; zod validates the format on submit.
export function InviteSheet({
  visible,
  onClose,
  onInvite,
  saving,
  error,
  done,
  reset,
}: InviteSheetProps) {
  const { t } = useTranslation();
  const { form, close, canSubmit } = useInviteSheetLogic({ done, onClose, reset });
  const submit = form.handleSubmit((values) => onInvite(values.email.trim()));

  return (
    <Sheet visible={visible} onClose={close} testID="invite-sheet">
      <Text className="text-lg font-semibold text-fg">{t("projectDetail.invite.title")}</Text>
      <Text className="mt-1.5 mb-5 text-[13px] leading-5 text-muted">
        {t("projectDetail.invite.copy")}
      </Text>
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField
            label={t("projectDetail.invite.emailLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            onSubmitEditing={submit}
            placeholder={t("projectDetail.invite.emailPlaceholder")}
            keyboardType="email-address"
            autoComplete="email"
            error={fieldState.error?.message}
            testID="invite-email"
          />
        )}
      />
      {error ? <Text className="mt-3 text-xs text-danger">{t(ERROR_KEY[error])}</Text> : null}
      <View className="mt-5 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t("projectDetail.invite.cancel")}
            variant="outline"
            onPress={close}
            testID="invite-cancel"
          />
        </View>
        <View className="flex-1">
          <Button
            label={t("projectDetail.invite.submit")}
            variant="accent"
            onPress={submit}
            loading={saving}
            disabled={!canSubmit}
            testID="invite-submit"
          />
        </View>
      </View>
    </Sheet>
  );
}
