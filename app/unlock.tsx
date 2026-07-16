import { Fingerprint } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UnlockPasswordForm } from "@/features/unlock/UnlockPasswordForm";
import { useUnlockLogic } from "@/features/unlock/useUnlockLogic";
import { useAccentColor } from "@/theme/useAccentColor";

export default function UnlockScreen() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const logic = useUnlockLogic();

  return (
    <SafeAreaView className="flex-1 bg-shell">
      <View className="flex-1 px-7 pt-10">
        <Text className="text-3xl font-bold text-fg">
          {logic.noVault ? t("unlock.noVaultTitle") : t("unlock.title")}
        </Text>
        <Text className="mt-3 text-sm leading-5 text-muted">
          {logic.noVault ? t("unlock.noVaultBody") : t("unlock.body")}
        </Text>
        {logic.noVault ? null : (
          <View className="mt-8 gap-4">
            {logic.biometricEnrolled ? (
              <Pressable
                onPress={logic.onRetryBiometric}
                disabled={logic.isBiometricPending}
                accessibilityRole="button"
                className="flex-row items-center justify-center gap-2 py-2"
              >
                <Fingerprint size={18} color={accent} />
                <Text className="text-sm font-semibold text-accent">
                  {t("unlock.biometricButton")}
                </Text>
              </Pressable>
            ) : null}
            <UnlockPasswordForm
              form={logic.form}
              onSubmit={logic.onSubmit}
              canSubmit={logic.canSubmit}
              isUnlocking={logic.isUnlocking}
              unlockError={logic.unlockError}
            />
          </View>
        )}
        <View className="flex-1" />
        <Pressable onPress={logic.signOut} accessibilityRole="button" className="items-center pb-6">
          <Text className="text-sm text-muted">{t("unlock.signOut")}</Text>
        </Pressable>
      </View>
    </SafeAreaView>
  );
}
