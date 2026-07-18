import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { RoleChip } from "@/components";
import type { StoredProject } from "@/store/projectsSlice";
import { colors } from "@/theme/colors";
import { projectInitials, ROLE_LABEL_KEY } from "./lib";
import { ProjectTile } from "./ProjectTile";

interface ProjectRowProps {
  readonly project: StoredProject;
  readonly onPress: () => void;
}

// A single project row on the Projects list: name (+ awaiting marker), optional
// description, a "N hosts · N members" subtitle, a role pill and a chevron.
export function ProjectRow({ project, onPress }: ProjectRowProps) {
  const { t } = useTranslation();
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      className="flex-row items-center gap-3 px-4 py-3"
    >
      <ProjectTile initials={projectInitials(project.name)} />
      <View className="min-w-0 flex-1">
        <View className="flex-row items-center gap-2">
          <Text className="text-[15px] font-semibold text-fg">{project.name}</Text>
          {project.awaiting ? (
            <Text className="text-xs text-warn">{t("projects.awaiting")}</Text>
          ) : null}
        </View>
        {project.description ? (
          <Text className="mt-px text-xs text-muted" numberOfLines={1}>
            {project.description}
          </Text>
        ) : null}
        <Text className="mt-0.5 text-xs text-muted">
          {t("projects.hostsMembers", {
            hosts: String(project.hosts.length),
            members: String(project.memberCount),
          })}
        </Text>
      </View>
      <RoleChip label={t(ROLE_LABEL_KEY[project.role])} variant="pill" />
      <ChevronRight size={20} color={colors.faint} />
    </Pressable>
  );
}
