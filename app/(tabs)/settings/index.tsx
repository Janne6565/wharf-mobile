import { useTranslation } from "react-i18next";
import { Switch, View } from "react-native";
import {
  Card,
  RowDivider,
  ScreenContainer,
  ScreenTitle,
  SectionLabel,
  SettingsRow,
} from "@/components";
import { ThemeAccentRow } from "@/features/settings/ThemeAccentRow";
import { useBiometricToggle } from "@/features/settings/useBiometricToggle";
import { useSettingsLogic } from "@/features/settings/useSettingsLogic";
import { colors } from "@/theme/colors";
import { useAccentColor } from "@/theme/useAccentColor";

function BiometricRow() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const { enrolled, available, busy, toggle } = useBiometricToggle({
    enrollPrompt: t("unlock.biometricPrompt"),
  });
  return (
    <SettingsRow
      label={t("settings.biometricUnlock")}
      // Show the "unavailable" hint only when the device genuinely lacks
      // biometric capability — never during a change in flight or after
      // disabling on a capable device.
      value={available ? undefined : t("settings.biometricUnavailable")}
      accessory={
        <Switch
          value={enrolled}
          disabled={(!enrolled && !available) || busy}
          onValueChange={(next) => void toggle(next)}
          trackColor={{ false: colors.border, true: accent }}
          testID="biometric-toggle"
        />
      }
    />
  );
}

export default function SettingsScreen() {
  const { t } = useTranslation();
  const {
    accent,
    selectAccent,
    language,
    toggleLanguage,
    account,
    showDeveloper,
    openCryptoSelfTest,
    lock,
    requestSignOut,
    version,
  } = useSettingsLogic();

  const onSignOut = () =>
    requestSignOut({
      title: t("settings.signOutConfirmTitle"),
      body: t("settings.signOutConfirmBody"),
      confirm: t("settings.signOutConfirm"),
      cancel: t("settings.signOutCancel"),
    });

  const method =
    account.method === "password"
      ? t("settings.methodPassword")
      : account.method === "oauth"
        ? t("settings.methodOauth")
        : undefined;

  return (
    <ScreenContainer>
      <ScreenTitle title={t("settings.title")} />

      <View className="mt-5">
        <SectionLabel>{t("settings.appearance")}</SectionLabel>
        <Card>
          <ThemeAccentRow label={t("settings.theme")} accent={accent} onSelect={selectAccent} />
          <RowDivider />
          <SettingsRow
            label={t("settings.language")}
            value={language.toUpperCase()}
            onPress={toggleLanguage}
            chevron
          />
        </Card>
      </View>

      <View className="mt-5">
        <SectionLabel>{t("settings.account")}</SectionLabel>
        <Card>
          <SettingsRow label={t("settings.email")} value={account.email} />
          {method ? (
            <>
              <RowDivider />
              <SettingsRow label={t("settings.signedInVia")} value={method} />
            </>
          ) : null}
          <RowDivider />
          <SettingsRow label={t("settings.signOut")} onPress={onSignOut} danger />
        </Card>
      </View>

      <View className="mt-5">
        <SectionLabel>{t("settings.security")}</SectionLabel>
        <Card>
          <BiometricRow />
          <RowDivider />
          {/* Lock vault is an action row: no chevron (not navigation) and no value
              chip — a keyboard-shortcut hint is meaningless on a phone. */}
          <SettingsRow label={t("settings.lockVault")} onPress={lock} />
        </Card>
      </View>

      <View className="mt-5">
        <SectionLabel>{t("settings.about")}</SectionLabel>
        <Card>
          <SettingsRow label={t("settings.version")} value={version} monoValue />
          {showDeveloper ? (
            <>
              <RowDivider />
              <SettingsRow label={t("settings.developer")} onPress={openCryptoSelfTest} chevron />
            </>
          ) : null}
        </Card>
      </View>
    </ScreenContainer>
  );
}
