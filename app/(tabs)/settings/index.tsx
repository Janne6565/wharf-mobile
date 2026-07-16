import { useTranslation } from "react-i18next";
import { View } from "react-native";
import { Card, RowDivider, ScreenContainer, ScreenTitle, SettingsRow } from "@/components";
import { useSettingsLogic } from "@/features/settings/useSettingsLogic";

export default function SettingsScreen() {
  const { t } = useTranslation();
  const { language } = useSettingsLogic();

  return (
    <ScreenContainer>
      <ScreenTitle title={t("settings.title")} />
      <View className="mt-5">
        <Card>
          <SettingsRow label={t("settings.theme")} />
          <RowDivider />
          <SettingsRow label={t("settings.language")} value={language.toUpperCase()} />
          <RowDivider />
          <SettingsRow label={t("settings.about")} />
        </Card>
      </View>
    </ScreenContainer>
  );
}
