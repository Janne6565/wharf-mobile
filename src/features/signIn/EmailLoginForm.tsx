import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Button, FormField } from "@/components";
import type { SignInValues } from "./useSignInLogic";

interface EmailLoginFormProps {
  readonly form: UseFormReturn<SignInValues>;
  readonly onSubmit: () => void;
  readonly onBack: () => void;
  readonly canSubmit: boolean;
  readonly isSubmitting: boolean;
  readonly submitError: string | null;
}

// The email + master-password form revealed by "Continue with email". All
// validation state comes from the sign-in logic hook via react-hook-form.
export function EmailLoginForm({
  form,
  onSubmit,
  onBack,
  canSubmit,
  isSubmitting,
  submitError,
}: EmailLoginFormProps) {
  const { t } = useTranslation();

  return (
    <View className="gap-4">
      <Controller
        control={form.control}
        name="email"
        render={({ field, fieldState }) => (
          <FormField
            label={t("signIn.emailLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t("signIn.emailPlaceholder")}
            keyboardType="email-address"
            autoComplete="email"
            error={fieldState.error?.message}
            testID="sign-in-email"
          />
        )}
      />
      <Controller
        control={form.control}
        name="password"
        render={({ field, fieldState }) => (
          <FormField
            label={t("signIn.passwordLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            secureTextEntry
            autoComplete="current-password"
            error={fieldState.error?.message}
            testID="sign-in-password"
          />
        )}
      />
      {submitError ? <Text className="text-xs text-danger">{submitError}</Text> : null}
      <Button
        label={t("signIn.submit")}
        variant="accent"
        onPress={onSubmit}
        disabled={!canSubmit}
        loading={isSubmitting}
        testID="sign-in-submit"
      />
      <Pressable onPress={onBack} accessibilityRole="button" className="items-center py-1">
        <Text className="text-sm text-muted">{t("signIn.back")}</Text>
      </Pressable>
    </View>
  );
}
