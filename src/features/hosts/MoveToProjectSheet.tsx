import { ChevronRight } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { ActivityIndicator, Pressable, Text, View } from "react-native";
import { Sheet } from "@/components";
import { colors } from "@/theme/colors";

// The subset of a project the picker renders. Kept minimal so the sheet does not
// depend on the full StoredProject shape.
interface ProjectOption {
  readonly id: string;
  readonly name: string;
}

interface MoveToProjectSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly projects: readonly ProjectOption[];
  // The project id whose move is in flight, so only that row shows a spinner.
  readonly movingProjectId?: string;
  readonly onSelect: (projectId: string) => void;
}

// The move-to-project picker: the keyed projects as tappable rows (a chevron, or a
// spinner while that project's move is in flight). Empty when the user has no
// writable project — a muted hint replaces the list.
export function MoveToProjectSheet({
  visible,
  onClose,
  projects,
  movingProjectId,
  onSelect,
}: MoveToProjectSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} testID="host-move-sheet">
      <Text className="text-lg font-semibold text-fg">{t("hostMenu.moveTitle")}</Text>
      <View className="mt-3">
        {projects.length === 0 ? (
          <Text className="py-4 text-sm text-muted">{t("hostMenu.moveEmpty")}</Text>
        ) : (
          projects.map((project) => (
            <Pressable
              key={project.id}
              testID={`host-move-project-${project.id}`}
              onPress={() => onSelect(project.id)}
              accessibilityRole="button"
              className="flex-row items-center gap-3 py-3.5"
            >
              <Text className="min-w-0 flex-1 text-[16px] text-fg">{project.name}</Text>
              {movingProjectId === project.id ? (
                <ActivityIndicator color={colors.accent} />
              ) : (
                <ChevronRight size={20} color={colors.faint} />
              )}
            </Pressable>
          ))
        )}
      </View>
    </Sheet>
  );
}
