import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { ScreenContainer, ScreenTitle } from "@/components";
import { useKeysLogic } from "@/features/keys/useKeysLogic";

export default function KeysScreen() {
  const { t } = useTranslation();
  useKeysLogic();

  return (
    <ScreenContainer>
      <ScreenTitle title={t("keys.title")} />
      <View className="mt-16 items-center px-6">
        <Text className="text-center text-sm text-muted">{t("keys.empty")}</Text>
      </View>
    </ScreenContainer>
  );
}
