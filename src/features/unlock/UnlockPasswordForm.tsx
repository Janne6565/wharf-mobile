import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, FormField } from "@/components";

interface UnlockValues {
  password: string;
}

interface UnlockPasswordFormProps {
  readonly form: UseFormReturn<UnlockValues>;
  readonly onSubmit: () => void;
  readonly canSubmit: boolean;
  readonly isUnlocking: boolean;
  readonly unlockError: string | null;
}

// The master-password fallback form on the unlock screen.
export function UnlockPasswordForm({
  form,
  onSubmit,
  canSubmit,
  isUnlocking,
  unlockError,
}: UnlockPasswordFormProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField
            label={t("unlock.passwordLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            secureTextEntry
            autoComplete="current-password"
            error={fieldState.error?.message}
            onSubmitEditing={onSubmit}
            testID="unlock-password"
          />
        )}
      />
      {unlockError ? <Text className="text-xs text-danger">{unlockError}</Text> : null}
      <Button
        label={t("unlock.submit")}
        variant="accent"
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={isUnlocking}
        testID="unlock-submit"
      />
    </View>
  );
}
