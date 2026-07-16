import { Stack } from "expo-router";
import { useTranslation } from "react-i18next";
import { Pressable, ScrollView, Text, View } from "react-native";
import { Card, RowDivider, ScreenContainer, ScreenTitle } from "@/components";
import { CheckRow } from "@/features/cryptoSelfTest/CheckRow";
import { useCryptoSelfTestLogic } from "@/features/cryptoSelfTest/useCryptoSelfTestLogic";

// Dev-only acceptance gate for M1: runs the fixture assertions against whatever
// primitive backend the platform resolved (native on device) and shows a
// PASS/FAIL list plus an argon2id timing row. Reachable from Settings ▸
// Developer (visible only when __DEV__).
export default function CryptoSelfTestScreen() {
  const { t } = useTranslation();
  const { backend, results, running, allPassed, argon2Ms, rerun } = useCryptoSelfTestLogic();

  const summary = running
    ? t("cryptoSelfTest.running")
    : allPassed
      ? t("cryptoSelfTest.allPassed")
      : t("cryptoSelfTest.someFailed");

  return (
    <ScreenContainer>
      <Stack.Screen options={{ headerShown: true, title: t("cryptoSelfTest.title") }} />
      <ScrollView showsVerticalScrollIndicator={false}>
        <View className="pt-2 pb-8">
          <ScreenTitle title={t("cryptoSelfTest.title")} />
          <Text className="mt-2 text-[13px] text-muted">
            {t("cryptoSelfTest.backend", { backend })}
          </Text>
          <Text className={allPassed ? "mt-1 text-[13px] text-ok" : "mt-1 text-[13px] text-fgSoft"}>
            {summary}
          </Text>

          <View className="mt-5">
            <Card>
              {results.map((result, idx) => (
                <View key={result.name}>
                  {idx > 0 ? <RowDivider /> : null}
                  <CheckRow result={result} />
                </View>
              ))}
            </Card>
          </View>

          <View className="mt-5">
            <Card>
              <View className="flex-row items-center gap-3 px-4 py-3.5">
                <Text className="flex-1 text-[13px] text-fg">
                  {t("cryptoSelfTest.argon2Timing")}
                </Text>
                <Text className="text-[13px] text-muted">
                  {argon2Ms === null ? "—" : `${argon2Ms} ms`}
                </Text>
              </View>
            </Card>
          </View>

          <Pressable
            onPress={rerun}
            disabled={running}
            className={running ? "mt-6 items-center py-3 opacity-40" : "mt-6 items-center py-3"}
          >
            <Text className="text-[15px] text-accent">{t("cryptoSelfTest.rerun")}</Text>
          </Pressable>
        </View>
      </ScrollView>
    </ScreenContainer>
  );
}
