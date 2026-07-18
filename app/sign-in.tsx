import { LinearGradient } from "expo-linear-gradient";
import { useTranslation } from "react-i18next";
import { KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import Svg, { Circle, Defs, RadialGradient, Stop } from "react-native-svg";
import { Button, WharfMark } from "@/components";
import { EmailLoginForm } from "@/features/signIn/EmailLoginForm";
import { useSignInLogic } from "@/features/signIn/useSignInLogic";
import { colors } from "@/theme/colors";
import { useAccentColor } from "@/theme/useAccentColor";

// The soft accent glow blob top-left (design: 440px circle at top:-140,left:-60,
// radial accent 10% → transparent 65%). Rendered as an SVG radial gradient so the
// falloff is smooth; purely decorative, so it never intercepts touches.
const GLOW_SIZE = 440;

function AtmosphereGlow({ accent }: { readonly accent: string }) {
  return (
    <Svg
      width={GLOW_SIZE}
      height={GLOW_SIZE}
      pointerEvents="none"
      style={{ position: "absolute", top: -140, left: -60 }}
    >
      <Defs>
        <RadialGradient id="signInGlow" cx="50%" cy="50%" r="50%">
          <Stop offset="0" stopColor={accent} stopOpacity={0.1} />
          <Stop offset="0.65" stopColor={accent} stopOpacity={0} />
        </RadialGradient>
      </Defs>
      <Circle cx={GLOW_SIZE / 2} cy={GLOW_SIZE / 2} r={GLOW_SIZE / 2} fill="url(#signInGlow)" />
    </Svg>
  );
}

export default function SignInScreen() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const logic = useSignInLogic();

  return (
    <SafeAreaView className="flex-1 bg-shell">
      {/* Full-screen vertical gradient (180deg, bottom stop at 40% height). */}
      <LinearGradient
        colors={[colors.shellTop, colors.shell]}
        locations={[0, 0.4]}
        style={StyleSheet.absoluteFill}
      />
      <AtmosphereGlow accent={accent} />
      <KeyboardAvoidingView
        className="flex-1"
        behavior={Platform.OS === "ios" ? "padding" : undefined}
      >
        <View className="flex-1 px-7 pb-9 pt-8">
          <View className="flex-[1.1]" />
          {/* Brand row: accent WharfMark + mono wordmark. NO decorative cursor
            (house decision: cursors only where the user can actually type). */}
          <View className="flex-row items-center gap-[14px]">
            <WharfMark size={46} />
            <Text className="font-mono-bold text-[34px] text-fg">{t("app.name")}</Text>
          </View>
          <Text className="mt-3 font-mono text-[13.5px] text-muted">{t("signIn.tagline")}</Text>
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
              {logic.providerError ? (
                <Text className="text-center text-xs text-danger">{logic.providerError}</Text>
              ) : null}
              <Button
                label={t("signIn.continueGoogle")}
                onPress={() => logic.signInWithProvider("google")}
                disabled={logic.isProviderDisabled("google")}
                loading={logic.providerPending === "google"}
              />
              <Button
                label={t("signIn.continueGithub")}
                onPress={() => logic.signInWithProvider("github")}
                disabled={logic.isProviderDisabled("github")}
                loading={logic.providerPending === "github"}
              />
              <Button
                label={t("signIn.continueEmail")}
                variant="outline"
                onPress={logic.openEmailForm}
              />
              <Pressable
                onPress={logic.goToPair}
                accessibilityRole="button"
                className="items-center py-1.5"
              >
                <Text className="text-[13px] text-muted">{t("signIn.usePairingCode")}</Text>
              </Pressable>
            </View>
          )}
          <Text className="mt-[18px] text-center text-[12.5px] leading-[19px] text-muted">
            {t("signIn.footer")}
          </Text>
        </View>
      </KeyboardAvoidingView>
    </SafeAreaView>
  );
}
