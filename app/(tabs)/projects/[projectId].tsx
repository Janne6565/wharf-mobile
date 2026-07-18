import { ChevronLeft, Circle, Plus, X } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ProjectInvite } from "@/api/generated/model";
import { Card, HostRow, RowDivider, ScreenContainer, SectionLabel } from "@/components";
import { InviteSheet } from "@/features/projects/InviteSheet";
import { MemberRow } from "@/features/projects/MemberRow";
import { useProjectDetailLogic } from "@/features/projects/useProjectDetailLogic";
import { colors } from "@/theme/colors";
import { useAccentColor } from "@/theme/useAccentColor";
import { hostTarget } from "@/vault/document";

interface PendingInviteLineProps {
  readonly invite: ProjectInvite;
  readonly canRevoke: boolean;
  readonly revoking: boolean;
  readonly onRevoke: (invite: ProjectInvite) => void;
}

function PendingInviteLine({ invite, canRevoke, revoking, onRevoke }: PendingInviteLineProps) {
  const { t } = useTranslation();
  return (
    <View className="mt-2.5 flex-row items-center gap-2.5 px-1">
      <Circle size={11} color={colors.warn} />
      <Text className="text-[13px] text-warn">{invite.email}</Text>
      <Text className="flex-1 text-xs text-muted">{t("projectDetail.inviteAwaiting")}</Text>
      {canRevoke ? <RevokeButton revoking={revoking} onPress={() => onRevoke(invite)} /> : null}
    </View>
  );
}

function RevokeButton({
  revoking,
  onPress,
}: {
  readonly revoking: boolean;
  readonly onPress: () => void;
}) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      disabled={revoking}
      accessibilityRole="button"
      accessibilityLabel={t("projectDetail.revoke")}
      className="flex-row items-center gap-1 px-1 py-0.5"
      testID="invite-revoke"
    >
      {revoking ? (
        <ActivityIndicator size="small" color={colors.muted} />
      ) : (
        <>
          <X size={13} color={colors.muted} />
          <Text className="text-xs text-muted">{t("projectDetail.revoke")}</Text>
        </>
      )}
    </Pressable>
  );
}

function InviteMemberRow({ onPress }: { readonly onPress: () => void }) {
  const { t } = useTranslation();
  const accent = useAccentColor();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-2 px-4 py-3"
      testID="invite-member-row"
    >
      <Plus size={16} color={accent} />
      <Text className="text-[15px] text-accent">{t("projectDetail.inviteAction")}</Text>
    </Pressable>
  );
}

// A shimmer-free placeholder shown while the members/invites detail loads (the
// summary list is already on screen from the synced state). Three muted bars
// stand in for member rows so the card does not pop in empty.
function MembersSkeleton() {
  return (
    <View className="mt-6" testID="project-detail-skeleton">
      <SectionLabel> </SectionLabel>
      <Card>
        {[0, 1, 2].map((row) => (
          <Fragment key={row}>
            {row > 0 ? <RowDivider /> : null}
            <View className="flex-row items-center gap-3 px-4 py-3.5">
              <View className="h-7 w-7 rounded-full bg-surface" />
              <View className="h-3.5 flex-1 rounded-full bg-surface" />
              <View className="h-3.5 w-12 rounded-full bg-surface" />
            </View>
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

// Project detail (mock screen 04): back link, title + "desc · N hosts", a members
// card with the "+ Invite member" row (admin/owner only), pending-invite lines
// with a revoke action (admin/owner), and a read-only hosts card.
export default function ProjectDetailScreen() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const {
    project,
    hosts,
    hostStatus,
    members,
    invites,
    currentUserId,
    canAdmin,
    loadingDetail,
    projectsLoaded,
    goBack,
    openHost,
    inviteOpen,
    openInvite,
    closeInvite,
    inviteMember,
    inviteSaving,
    inviteError,
    inviteDone,
    resetInvite,
    confirmRevoke,
    revokingId,
  } = useProjectDetailLogic();

  const summary = project?.description
    ? t("projectDetail.summary", { description: project.description, hosts: String(hosts.length) })
    : t("projectDetail.summaryNoDesc", { hosts: String(hosts.length) });

  const onRevoke = (invite: ProjectInvite) =>
    confirmRevoke(invite.id ?? "", {
      title: t("projectDetail.revokeConfirmTitle"),
      body: t("projectDetail.revokeConfirmBody", { email: invite.email ?? "" }),
      confirm: t("projectDetail.revokeConfirm"),
      cancel: t("projectDetail.revokeCancel"),
    });

  return (
    <ScreenContainer>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        className="-ml-1 flex-row items-center py-2"
      >
        <ChevronLeft size={22} color={accent} />
        <Text className="text-[15px] text-accent">{t("projectDetail.back")}</Text>
      </Pressable>

      {project ? (
        <>
          <Text className="mt-1 text-[26px] font-bold text-fg">{project.name}</Text>
          <Text className="mt-0.5 text-[13px] text-muted">{summary}</Text>

          {loadingDetail && members.length === 0 && !canAdmin ? <MembersSkeleton /> : null}
          {members.length > 0 || canAdmin ? (
            <View className="mt-6">
              <SectionLabel>{t("projectDetail.members")}</SectionLabel>
              <Card>
                {members.map((member, index) => (
                  <Fragment key={member.userId ?? member.email}>
                    {index > 0 ? <RowDivider /> : null}
                    <MemberRow member={member} isYou={member.userId === currentUserId} />
                  </Fragment>
                ))}
                {canAdmin ? (
                  <>
                    {members.length > 0 ? <RowDivider /> : null}
                    <InviteMemberRow onPress={openInvite} />
                  </>
                ) : null}
              </Card>
            </View>
          ) : null}
          {invites.map((invite) => (
            <PendingInviteLine
              key={invite.id ?? invite.email}
              invite={invite}
              canRevoke={canAdmin}
              revoking={revokingId === invite.id}
              onRevoke={onRevoke}
            />
          ))}

          <View className="mt-5">
            <SectionLabel>{t("projectDetail.hosts")}</SectionLabel>
            {hosts.length > 0 ? (
              <Card>
                {hosts.map((host, index) => (
                  <Fragment key={host.id}>
                    {index > 0 ? <RowDivider /> : null}
                    <HostRow
                      name={host.name}
                      target={hostTarget(host)}
                      status={hostStatus(host.id)}
                      onPress={() => openHost(host.id)}
                    />
                  </Fragment>
                ))}
              </Card>
            ) : (
              <Text className="px-1 text-sm text-muted">{t("projectDetail.noHosts")}</Text>
            )}
          </View>

          {canAdmin ? (
            <InviteSheet
              visible={inviteOpen}
              onClose={closeInvite}
              onInvite={inviteMember}
              saving={inviteSaving}
              error={inviteError}
              done={inviteDone}
              reset={resetInvite}
            />
          ) : null}
        </>
      ) : !projectsLoaded || loadingDetail ? (
        <MembersSkeleton />
      ) : (
        <Text className="mt-16 text-center text-sm text-muted">{t("projectDetail.notFound")}</Text>
      )}
    </ScreenContainer>
  );
}
