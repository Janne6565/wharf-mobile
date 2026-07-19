import { CloudOff, Info } from "lucide-react-native";
import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import {
  AddButton,
  Card,
  ListSkeleton,
  RowDivider,
  ScreenContainer,
  ScreenTitle,
} from "@/components";
import { InviteCard } from "@/features/projects/InviteCard";
import { ProjectFormSheet } from "@/features/projects/ProjectFormSheet";
import { ProjectRow } from "@/features/projects/ProjectRow";
import { useProjectsLogic } from "@/features/projects/useProjectsLogic";
import { colors } from "@/theme/colors";

function Notice({
  icon,
  title,
  body,
}: {
  readonly icon: "info" | "offline";
  readonly title: string;
  readonly body?: string;
}) {
  const Icon = icon === "offline" ? CloudOff : Info;
  return (
    <View className="mt-3 flex-row items-start gap-2 rounded-field border border-borderSoft bg-surface px-3 py-2.5">
      <Icon size={16} color={colors.warn} />
      <View className="flex-1">
        <Text className="text-xs font-semibold text-fg">{title}</Text>
        {body ? <Text className="mt-0.5 text-xs text-muted">{body}</Text> : null}
      </View>
    </View>
  );
}

function CenteredMessage({ title, body }: { readonly title: string; readonly body?: string }) {
  return (
    <View className="mt-16 items-center px-6">
      <Text className="text-center text-lg font-semibold text-fg">{title}</Text>
      {body ? <Text className="mt-2 text-center text-sm text-muted">{body}</Text> : null}
    </View>
  );
}

export default function ProjectsScreen() {
  const { t } = useTranslation();
  const {
    projects,
    invites,
    offline,
    identityNeedsSync,
    openProject,
    acceptInvite,
    declineInvite,
    respondingId,
    createOpen,
    openCreate,
    closeCreate,
    submitCreate,
    creating,
    showLoading,
    showEmpty,
  } = useProjectsLogic();

  return (
    <ScreenContainer>
      <ScreenTitle
        title={t("projects.title")}
        action={<AddButton onPress={openCreate} testID="projects-add" />}
      />
      {identityNeedsSync ? (
        <Notice
          icon="info"
          title={t("projects.needsSyncTitle")}
          body={t("projects.needsSyncBody")}
        />
      ) : null}
      {offline ? <Notice icon="offline" title={t("projects.offline")} /> : null}

      {invites.length > 0 ? (
        <View className="mt-4">
          {invites.map((invite) => (
            <InviteCard
              key={invite.id}
              invite={invite}
              onAccept={acceptInvite}
              onDecline={declineInvite}
              busy={respondingId === invite.id}
            />
          ))}
        </View>
      ) : null}

      {projects.length > 0 ? (
        <View className="mt-4">
          <Card>
            {projects.map((project, index) => (
              <Fragment key={project.id}>
                {index > 0 ? <RowDivider /> : null}
                <ProjectRow project={project} onPress={() => openProject(project.id)} />
              </Fragment>
            ))}
          </Card>
        </View>
      ) : null}

      {showLoading ? <ListSkeleton testID="projects-skeleton" /> : null}
      {showEmpty ? (
        <CenteredMessage title={t("projects.empty")} body={t("projects.emptyBody")} />
      ) : null}

      <ProjectFormSheet
        visible={createOpen}
        onClose={closeCreate}
        title={t("projects.createTitle")}
        submitLabel={t("projects.createSubmit")}
        initialName=""
        initialDescription=""
        saving={creating}
        onSubmit={submitCreate}
      />
    </ScreenContainer>
  );
}
