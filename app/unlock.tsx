import { Lock } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { UnlockPasswordForm } from "@/features/unlock/UnlockPasswordForm";
import { useUnlockLogic } from "@/features/unlock/useUnlockLogic";
import { hexToRgba } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";

export default function UnlockScreen() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const logic = useUnlockLogic();

  return (
    <SafeAreaView className="flex-1 bg-shell">
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-7 pb-9 pt-10">
          {/* Header: title left, Sign out top-right (moved up from the footer). */}
          <View className="flex-row items-start">
            <Text className="font-mono-bold text-2xl lowercase text-fg">
              {logic.noVault ? t("unlock.noVaultTitle") : t("unlock.title")}
            </Text>
            <Pressable
              onPress={logic.signOut}
              accessibilityRole="button"
              className="ml-auto pt-1.5"
            >
              <Text className="text-[13px] text-muted">{t("unlock.signOut")}</Text>
            </Pressable>
          </View>
          <Text className="mt-2.5 text-[13.5px] leading-[21px] text-muted">
            {logic.noVault ? t("unlock.noVaultBody") : t("unlock.body")}
          </Text>
          {logic.noVault ? (
            <View className="flex-1" />
          ) : (
            <>
              <View className="flex-1 items-center justify-center gap-4">
                {logic.biometricEnrolled ? (
                  <Pressable
                    onPress={logic.onRetryBiometric}
                    disabled={logic.isBiometricPending}
                    accessibilityRole="button"
                    className="items-center gap-4"
                  >
                    <View
                      className="h-[92px] w-[92px] items-center justify-center rounded-full border border-borderStrong bg-surface"
                      style={{ boxShadow: `0 0 40px ${hexToRgba(accent, 0.14)}` }}
                    >
                      <Lock size={38} color={accent} strokeWidth={1.8} />
                    </View>
                    <Text className="text-[13.5px] font-semibold text-accent">
                      {t("unlock.biometricButton")}
                    </Text>
                  </Pressable>
                ) : null}
              </View>
              <UnlockPasswordForm
                form={logic.form}
                onSubmit={logic.onSubmit}
                canSubmit={logic.canSubmit}
                isUnlocking={logic.isUnlocking}
                unlockError={logic.unlockError}
              />
            </>
          )}
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
