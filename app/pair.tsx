import { useRouter } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { SafeAreaView } from "react-native-safe-area-context";
import { API_BASE } from "@/api/axios-instance";
import { Button, FormField } from "@/components";
import { usePairLogic } from "@/features/pair/usePairLogic";

// Host shown in the instruction copy — the web origin without the scheme.
const WEB_HOST = API_BASE.replace(/^https?:\/\//, "");

export default function PairScreen() {
  const { t } = useTranslation();
  const router = useRouter();
  const logic = usePairLogic();

  return (
    <SafeAreaView className="flex-1 bg-shell">
      <View className="flex-1 px-7 pt-10">
        <Text className="text-3xl font-bold text-fg">{t("pair.title")}</Text>
        <Text className="mt-3 text-sm leading-5 text-muted">
          {t("pair.body", { host: WEB_HOST })}
        </Text>
        <View className="mt-8 gap-4">
          <FormField
            label={t("pair.codeLabel")}
            value={logic.code}
            onChangeText={logic.onChangeCode}
            placeholder={t("pair.codePlaceholder")}
            autoCapitalize="characters"
            maxLength={9}
            error={logic.submitError ?? undefined}
            onSubmitEditing={logic.onSubmit}
            testID="pair-code"
          />
          <Button
            label={t("pair.submit")}
            variant="accent"
            onPress={logic.onSubmit}
            disabled={!logic.canSubmit}
            loading={logic.isSubmitting}
            testID="pair-submit"
          />
          <Pressable
            onPress={() => router.back()}
            accessibilityRole="button"
            className="items-center py-1"
          >
            <Text className="text-sm text-muted">{t("pair.back")}</Text>
          </Pressable>
        </View>
      </View>
    </SafeAreaView>
  );
}
