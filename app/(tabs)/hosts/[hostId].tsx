import { ChevronLeft, FolderGit2, Pencil } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import type { HostStatus } from "@/components";
import { Button, Card, RowDivider, ScreenContainer, StatusDot } from "@/components";
import { useHostDetailLogic } from "@/features/hosts/useHostDetailLogic";
import { colors } from "@/theme/colors";
import { useAccentColor } from "@/theme/useAccentColor";

function DetailRow({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-muted">{label}</Text>
      <Text className="font-mono text-[14px] text-fg">{value}</Text>
    </View>
  );
}

// A single tag rendered as a pill chip (v2 host detail): the tags row shows these
// wrapped and right-aligned instead of a comma-joined string.
function TagChip({ label }: { readonly label: string }) {
  return (
    <View className="rounded-full border border-borderStrong bg-chip px-2.5 py-1">
      <Text className="font-mono text-[11px] text-dim">{label}</Text>
    </View>
  );
}

// The tags row: muted label on the left, right-aligned wrapped chips.
function TagsRow({ label, tags }: { readonly label: string; readonly tags: readonly string[] }) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="text-[15px] text-muted">{label}</Text>
      <View className="flex-1 flex-row flex-wrap justify-end gap-1.5">
        {tags.map((tag) => (
          <TagChip key={tag} label={tag} />
        ))}
      </View>
    </View>
  );
}

// The reachability row: the label on the left, then the status dot and a text
// value (with the dial RTT appended for a reachable host, e.g. "online · 42 ms").
function StatusRow({
  label,
  status,
  value,
}: {
  readonly label: string;
  readonly status: HostStatus;
  readonly value: string;
}) {
  return (
    <View className="flex-row items-center gap-3 px-4 py-3.5">
      <Text className="flex-1 text-[15px] text-muted">{label}</Text>
      <StatusDot status={status} />
      <Text className="text-[15px] text-fg">{value}</Text>
    </View>
  );
}

// Host detail (name/user/addr/port/tags) with Edit + Delete actions. The terminal
// session slots in post-v1 without restructuring this screen.
function ProjectBadge({ projectName }: { readonly projectName: string }) {
  const { t } = useTranslation();
  return (
    <View className="mt-6 flex-row items-start gap-2 rounded-field border border-borderFaint bg-surface px-3 py-2.5">
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
    status,
    rttMs,
    isProjectHost,
    cameFromProject,
    projectName,
    goBack,
    openEdit,
    openTerminal,
    confirmDelete,
    isDeleting,
  } = useHostDetailLogic();

  // When the user came from a project detail, the back link points back to that
  // project — labelled with its name, or a generic "Project" when it's unavailable.
  const backLabel = cameFromProject
    ? (projectName ?? t("hostDetail.backToProject"))
    : t("hostDetail.back");

  const statusLabel = t(`hosts.status.${status}`);
  // Append the dial RTT only for a reachable host (online/degraded); offline and
  // unknown have no meaningful latency to show.
  const statusValue =
    status === "online" || status === "degraded"
      ? t("hosts.status.rtt", { status: statusLabel, ms: String(rttMs) })
      : statusLabel;

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
          <Text className="text-[15px] text-accent">{backLabel}</Text>
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
              glyph="❯_"
              onPress={openTerminal}
              testID="host-detail-connect"
            />
          </View>
          <View className="mt-6">
            <Card>
              <StatusRow label={t("hosts.status.label")} status={status} value={statusValue} />
              <RowDivider />
              <DetailRow label={t("hostDetail.user")} value={host.user} />
              <RowDivider />
              <DetailRow label={t("hostDetail.address")} value={host.addr} />
              <RowDivider />
              <DetailRow label={t("hostDetail.port")} value={String(host.port)} />
              {host.tags && host.tags.length > 0 ? (
                <>
                  <RowDivider />
                  <TagsRow label={t("hostDetail.tags")} tags={host.tags} />
                </>
              ) : null}
            </Card>
          </View>
          {showActions ? (
            <View className="mt-6">
              <Button
                label={t("hostForm.delete")}
                variant="danger"
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
