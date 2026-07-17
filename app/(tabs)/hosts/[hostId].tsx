import { ChevronLeft, FolderGit2, Pencil } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Button, Card, RowDivider, ScreenContainer } from "@/components";
import { useHostDetailLogic } from "@/features/hosts/useHostDetailLogic";
import { colors } from "@/theme/colors";
import { useAccentColor } from "@/theme/useAccentColor";

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-muted">{label}</Text>
      <Text className="font-mono text-[15px] text-fg">{value}</Text>
    </View>
  );
}

// Host detail (name/user/addr/port/tags) with Edit + Delete actions. The terminal
// session slots in post-v1 without restructuring this screen.
function ProjectBadge({ projectName }: { readonly projectName: string }) {
  const { t } = useTranslation();
  return (
    <View className="mt-6 flex-row items-start gap-2 rounded-field border border-borderSoft bg-surface px-3 py-2.5">
      <FolderGit2 size={16} color={colors.muted} />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-fg">{t("hostDetail.projectBadge")}</Text>
        <Text className="mt-0.5 text-xs text-muted">
          {t("hostDetail.projectBadgeBody", { project: projectName })}
        </Text>
      </View>
    </View>
  );
}

export default function HostDetailScreen() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const {
    host,
    target,
    isProjectHost,
    projectName,
    goBack,
    openEdit,
    openTerminal,
    confirmDelete,
    isDeleting,
  } = useHostDetailLogic();

  const onDelete = () =>
    confirmDelete({
      title: t("hostForm.deleteConfirmTitle"),
      body: t("hostForm.deleteConfirmBody", { name: host?.name ?? "" }),
      confirm: t("hostForm.deleteConfirm"),
      cancel: t("hostForm.deleteCancel"),
    });

  // Project hosts are read-only on mobile v1: no Edit affordance, no Delete.
  const showActions = Boolean(host) && !isProjectHost;

  return (
    <ScreenContainer>
      <View className="flex-row items-center justify-between">
        <Pressable
          onPress={goBack}
          accessibilityRole="button"
          className="-ml-1 flex-row items-center py-2"
        >
          <ChevronLeft size={22} color={accent} />
          <Text className="text-[15px] text-accent">{t("hostDetail.back")}</Text>
        </Pressable>
        {showActions ? (
          <Pressable
            onPress={openEdit}
            accessibilityRole="button"
            testID="host-detail-edit"
            className="flex-row items-center gap-1.5 py-2"
          >
            <Pencil size={16} color={accent} />
            <Text className="text-[15px] text-accent">{t("hostDetail.edit")}</Text>
          </Pressable>
        ) : null}
      </View>
      {host ? (
        <>
          <Text className="mt-1 font-mono-bold text-2xl text-fg">{host.name}</Text>
          <Text className="mt-1 text-[13px] text-muted">{target}</Text>
          {isProjectHost && projectName ? <ProjectBadge projectName={projectName} /> : null}
          <View className="mt-6">
            <Button
              label={t("terminal.connect")}
              variant="accent"
              onPress={openTerminal}
              testID="host-detail-connect"
            />
          </View>
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
          {showActions ? (
            <View className="mt-6">
              <Button
                label={t("hostForm.delete")}
                variant="outline"
                onPress={onDelete}
                loading={isDeleting}
                testID="host-detail-delete"
              />
            </View>
          ) : null}
        </>
      ) : (
        <Text className="mt-16 text-center text-sm text-muted">{t("hostDetail.notFound")}</Text>
      )}
    </ScreenContainer>
  );
}
