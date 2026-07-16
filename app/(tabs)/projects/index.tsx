import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ScreenContainer, ScreenTitle } from "@/components";
import { useProjectsLogic } from "@/features/projects/useProjectsLogic";

export default function ProjectsScreen() {
  const { t } = useTranslation();
  useProjectsLogic();

  return (
    <ScreenContainer>
      <ScreenTitle title={t("projects.title")} />
      <View className="mt-16 items-center px-6">
        <Text className="text-center text-lg font-semibold text-fg">
          {t("projects.teamFeatureTitle")}
        </Text>
        <Text className="mt-2 text-center text-sm text-muted">{t("projects.teamFeatureBody")}</Text>
      </View>
    </ScreenContainer>
  );
}
