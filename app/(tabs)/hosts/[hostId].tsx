import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Card, RowDivider, ScreenContainer } from "@/components";
import { useHostDetailLogic } from "@/features/hosts/useHostDetailLogic";
import { colors } from "@/theme/colors";

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-muted">{label}</Text>
      <Text className="font-mono text-[15px] text-fg">{value}</Text>
    </View>
  );
}

// Read-only host detail (name/user/addr/port/tags). Editing is M3; the terminal
// session slots in post-v1 without restructuring this screen.
export default function HostDetailScreen() {
  const { t } = useTranslation();
  const { host, target, goBack } = useHostDetailLogic();

  return (
    <ScreenContainer>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        className="-ml-1 flex-row items-center py-2"
      >
        <ChevronLeft size={22} color={colors.accent} />
        <Text className="text-[15px] text-accent">{t("hostDetail.back")}</Text>
      </Pressable>
      {host ? (
        <>
          <Text className="mt-1 font-mono-bold text-2xl text-fg">{host.name}</Text>
          <Text className="mt-1 text-[13px] text-muted">{target}</Text>
          <View className="mt-6">
            <Card>
              <DetailRow label={t("hostDetail.user")} value={host.user} />
              <RowDivider />
              <DetailRow label={t("hostDetail.address")} value={host.addr} />
              <RowDivider />
              <DetailRow label={t("hostDetail.port")} value={String(host.port)} />
              {host.tags && host.tags.length > 0 ? (
                <>
                  <RowDivider />
                  <DetailRow label={t("hostDetail.tags")} value={host.tags.join(", ")} />
                </>
              ) : null}
            </Card>
          </View>
        </>
      ) : (
        <Text className="mt-16 text-center text-sm text-muted">{t("hostDetail.notFound")}</Text>
      )}
    </ScreenContainer>
  );
}
