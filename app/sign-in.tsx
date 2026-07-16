import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { Button } from "@/components";
import { EmailLoginForm } from "@/features/signIn/EmailLoginForm";
import { useSignInLogic } from "@/features/signIn/useSignInLogic";

// The brand glyph is a fixed mark (mock 01), not an icon — rendered as text by
// design, with NO decorative cursor (house decision: cursors only where the
// user can actually type).
const BRAND_GLYPH = "⋻";

export default function SignInScreen() {
  const { t } = useTranslation();
  const logic = useSignInLogic();

  return (
    <SafeAreaView className="flex-1 bg-shell">
      <View className="flex-1 px-7 pb-6 pt-8">
        <View className="flex-[1.1]" />
        <Text className="font-mono-bold text-[32px] text-accent">
          {BRAND_GLYPH} {t("app.name")}
        </Text>
        <Text className="mt-2 font-mono text-sm text-muted">{t("signIn.tagline")}</Text>
        <View className="flex-1" />
        {logic.showEmailForm ? (
          <EmailLoginForm
            form={logic.form}
            onSubmit={logic.onSubmit}
            onBack={logic.closeEmailForm}
            canSubmit={logic.canSubmit}
            isSubmitting={logic.isSubmitting}
            submitError={logic.submitError}
          />
        ) : (
          <View className="gap-3">
            <Button label={t("signIn.continueGoogle")} onPress={logic.openProviderSignIn} />
            <Button label={t("signIn.continueGithub")} onPress={logic.openProviderSignIn} />
            <Button
              label={t("signIn.continueEmail")}
              variant="outline"
              onPress={logic.openEmailForm}
            />
          </View>
        )}
        <Text className="mt-6 text-center text-[13px] leading-5 text-muted">
          {t("signIn.footer")}
        </Text>
      </View>
    </SafeAreaView>
  );
}
