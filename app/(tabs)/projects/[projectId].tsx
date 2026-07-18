import { ChevronLeft, LogOut, type LucideIcon, Pencil, Plus, Trash2, X } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import type { ProjectInvite } from "@/api/generated/model";
import { Card, HostRow, RowDivider, ScreenContainer, SectionLabel } from "@/components";
import { InviteSheet } from "@/features/projects/InviteSheet";
import { projectInitials } from "@/features/projects/lib";
import { MemberRow } from "@/features/projects/MemberRow";
import { ProjectFormSheet } from "@/features/projects/ProjectFormSheet";
import { ProjectTile } from "@/features/projects/ProjectTile";
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
      <View className="h-[7px] w-[7px] rounded-full border-[1.5px] border-warn" />
      <Text className="font-mono text-[12.5px] text-warn">{invite.email}</Text>
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

interface ManageRowProps {
  readonly icon: LucideIcon;
  readonly label: string;
  readonly onPress: () => void;
  readonly danger?: boolean;
  readonly testID?: string;
}

// A single row in the project management card: an accent action (edit) or a
// danger action (delete/leave), styled to match the invite row.
function ManageRow({ icon: Icon, label, onPress, danger = false, testID }: ManageRowProps) {
  const accent = useAccentColor();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-2 px-4 py-3.5"
      testID={testID}
    >
      <Icon size={16} color={danger ? colors.danger : accent} />
      <Text className={danger ? "text-[15px] text-danger" : "text-[15px] text-accent"}>
        {label}
      </Text>
    </Pressable>
  );
}

interface ProjectManageSectionProps {
  readonly canAdmin: boolean;
  readonly isOwner: boolean;
  readonly onEdit: () => void;
  readonly onDelete: () => void;
  readonly onLeave: () => void;
}

// The management card (mock 04, below the hosts): an "Edit project" row for
// admins/owners, then a single destructive row — "Delete project" for the owner,
// "Leave project" for everyone else (the owner cannot leave without transferring
// ownership, which mobile v1 does not surface).
function ProjectManageSection({
  canAdmin,
  isOwner,
  onEdit,
  onDelete,
  onLeave,
}: ProjectManageSectionProps) {
  const { t } = useTranslation();
  return (
    <View className="mt-6">
      <SectionLabel>{t("projectDetail.manage")}</SectionLabel>
      <Card>
        {canAdmin ? (
          <ManageRow
            icon={Pencil}
            label={t("projectDetail.editAction")}
            onPress={onEdit}
            testID="project-edit-row"
          />
        ) : null}
        {canAdmin ? <RowDivider /> : null}
        {isOwner ? (
          <ManageRow
            icon={Trash2}
            label={t("projectDetail.deleteAction")}
            onPress={onDelete}
            danger
            testID="project-delete-row"
          />
        ) : (
          <ManageRow
            icon={LogOut}
            label={t("projectDetail.leaveAction")}
            onPress={onLeave}
            danger
            testID="project-leave-row"
          />
        )}
      </Card>
    </View>
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
    isOwner,
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
    editOpen,
    openEdit,
    closeEdit,
    submitEdit,
    editSaving,
    confirmDelete,
    confirmLeave,
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

  const onDelete = () =>
    confirmDelete({
      title: t("projectDetail.deleteConfirmTitle"),
      body: t("projectDetail.deleteConfirmBody", { name: project?.name ?? "" }),
      confirm: t("projectDetail.deleteConfirm"),
      cancel: t("projectDetail.deleteCancel"),
    });

  const onLeave = () =>
    confirmLeave({
      title: t("projectDetail.leaveConfirmTitle"),
      body: t("projectDetail.leaveConfirmBody", { name: project?.name ?? "" }),
      confirm: t("projectDetail.leaveConfirm"),
      cancel: t("projectDetail.leaveCancel"),
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
          <View className="mt-1 flex-row items-center gap-[13px]">
            <ProjectTile initials={projectInitials(project.name)} size="lg" />
            <View className="min-w-0 flex-1">
              <Text className="text-[22px] font-bold text-fg">{project.name}</Text>
              <Text className="mt-px text-[12.5px] text-muted">{summary}</Text>
            </View>
          </View>

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

          <ProjectManageSection
            canAdmin={canAdmin}
            isOwner={isOwner}
            onEdit={openEdit}
            onDelete={onDelete}
            onLeave={onLeave}
          />

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
          {canAdmin ? (
            <ProjectFormSheet
              visible={editOpen}
              onClose={closeEdit}
              title={t("projectDetail.editTitle")}
              submitLabel={t("projectDetail.editSubmit")}
              initialName={project.name}
              initialDescription={project.description}
              saving={editSaving}
              onSubmit={submitEdit}
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
