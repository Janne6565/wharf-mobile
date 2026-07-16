import { ChevronLeft, Circle } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import type { ProjectInvite } from "@/api/generated/model";
import { Card, HostRow, RowDivider, ScreenContainer, SectionLabel } from "@/components";
import { MemberRow } from "@/features/projects/MemberRow";
import { useProjectDetailLogic } from "@/features/projects/useProjectDetailLogic";
import { colors } from "@/theme/colors";
import { hostTarget } from "@/vault/document";

function PendingInviteLine({ invite }: { readonly invite: ProjectInvite }) {
  const { t } = useTranslation();
  return (
    <View className="mt-2.5 flex-row items-center gap-2.5 px-1">
      <Circle size={11} color={colors.warn} />
      <Text className="text-[13px] text-warn">{invite.email}</Text>
      <Text className="text-xs text-muted">{t("projectDetail.inviteAwaiting")}</Text>
    </View>
  );
}

// Project detail (mock screen 04): back link, title + "desc · N hosts", a members
// card, pending-invite lines, and a read-only hosts card. "+ Invite member" is not
// active this milestone (M5), so it is intentionally omitted.
export default function ProjectDetailScreen() {
  const { t } = useTranslation();
  const { project, hosts, members, invites, currentUserId, goBack, openHost } =
    useProjectDetailLogic();

  const summary = project?.description
    ? t("projectDetail.summary", { description: project.description, hosts: String(hosts.length) })
    : t("projectDetail.summaryNoDesc", { hosts: String(hosts.length) });

  return (
    <ScreenContainer>
      <Pressable
        onPress={goBack}
        accessibilityRole="button"
        className="-ml-1 flex-row items-center py-2"
      >
        <ChevronLeft size={22} color={colors.accent} />
        <Text className="text-[15px] text-accent">{t("projectDetail.back")}</Text>
      </Pressable>

      {project ? (
        <>
          <Text className="mt-1 text-[26px] font-bold text-fg">{project.name}</Text>
          <Text className="mt-0.5 text-[13px] text-muted">{summary}</Text>

          {members.length > 0 ? (
            <View className="mt-6">
              <SectionLabel>{t("projectDetail.members")}</SectionLabel>
              <Card>
                {members.map((member, index) => (
                  <Fragment key={member.userId ?? member.email}>
                    {index > 0 ? <RowDivider /> : null}
                    <MemberRow member={member} isYou={member.userId === currentUserId} />
                  </Fragment>
                ))}
              </Card>
            </View>
          ) : null}
          {invites.map((invite) => (
            <PendingInviteLine key={invite.id ?? invite.email} invite={invite} />
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
                      status="unknown"
                      onPress={() => openHost(host.id)}
                    />
                  </Fragment>
                ))}
              </Card>
            ) : (
              <Text className="px-1 text-sm text-muted">{t("projectDetail.noHosts")}</Text>
            )}
          </View>
        </>
      ) : (
        <Text className="mt-16 text-center text-sm text-muted">{t("projectDetail.notFound")}</Text>
      )}
    </ScreenContainer>
  );
}
