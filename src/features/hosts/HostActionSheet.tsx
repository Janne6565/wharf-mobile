import { FolderInput, SquarePen, Terminal, Trash2 } from "lucide-react-native";
import type { ReactNode } from "react";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Sheet } from "@/components";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";

interface ActionRowProps {
  readonly icon: ReactNode;
  readonly label: string;
  readonly onPress: () => void;
  readonly testID: string;
  readonly danger?: boolean;
}

function ActionRow({ icon, label, onPress, testID, danger }: ActionRowProps) {
  return (
    <Pressable
      onPress={onPress}
      accessibilityRole="button"
      testID={testID}
      className="flex-row items-center gap-3 py-3.5"
    >
      {icon}
      <Text className={cn("text-[16px]", danger ? "text-danger" : "text-fg")}>{label}</Text>
    </Pressable>
  );
}

interface HostActionSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly hostName: string;
  // A project host is read-only on mobile v1 → Connect only.
  readonly isProjectHost: boolean;
  readonly onConnect: () => void;
  readonly onEdit: () => void;
  readonly onMove: () => void;
  readonly onDelete: () => void;
}

// The long-press context menu for a host row: a Sheet titled with the host name and
// the action rows. Personal hosts get all four (connect/edit/move/delete); a project
// host gets Connect only, since project hosts cannot be edited/moved/deleted here.
export function HostActionSheet({
  visible,
  onClose,
  hostName,
  isProjectHost,
  onConnect,
  onEdit,
  onMove,
  onDelete,
}: HostActionSheetProps) {
  const { t } = useTranslation();
  return (
    <Sheet visible={visible} onClose={onClose} testID="host-action-sheet">
      <Text className="font-mono text-[15px] text-fg">{hostName}</Text>
      <View className="mt-2">
        <ActionRow
          testID="host-action-connect"
          icon={<Terminal size={18} color={colors.dim} />}
          label={t("hostMenu.connect")}
          onPress={onConnect}
        />
        {isProjectHost ? null : (
          <>
            <ActionRow
              testID="host-action-edit"
              icon={<SquarePen size={18} color={colors.dim} />}
              label={t("hostMenu.edit")}
              onPress={onEdit}
            />
            <ActionRow
              testID="host-action-move"
              icon={<FolderInput size={18} color={colors.dim} />}
              label={t("hostMenu.moveToProject")}
              onPress={onMove}
            />
            <ActionRow
              testID="host-action-delete"
              icon={<Trash2 size={18} color={colors.danger} />}
              label={t("hostMenu.delete")}
              onPress={onDelete}
              danger
            />
          </>
        )}
      </View>
    </Sheet>
  );
}
