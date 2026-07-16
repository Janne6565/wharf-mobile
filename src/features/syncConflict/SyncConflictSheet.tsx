import { useTranslation } from "react-i18next";
import { Modal, Text, View } from "react-native";
import { Button } from "@/components";
import { formatRemoteUpdatedAt, useSyncConflictLogic } from "./useSyncConflictLogic";

// The both-sides-changed resolution sheet (mock parity with the TUI conflict
// modal): host counts on each side, the remote's last-updated time, and a
// keep-local / take-remote choice. Rendered once at the tabs layout so it
// overlays whichever tab is active.
export function SyncConflictSheet() {
  const { t } = useTranslation();
  const { conflict, resolving, keepLocal, takeRemote } = useSyncConflictLogic();
  const updatedAt = formatRemoteUpdatedAt(conflict?.remoteUpdatedAt ?? null);

  return (
    <Modal visible={conflict !== null} transparent animationType="fade" onRequestClose={takeRemote}>
      <View className="flex-1 items-center justify-center bg-black/60 px-6">
        <View className="w-full rounded-card border border-border bg-surface p-5">
          <Text className="font-mono-bold text-lg text-fg">{t("sync.conflictTitle")}</Text>
          <Text className="mt-2 text-sm text-muted">
            {t("sync.conflictBody", {
              local: String(conflict?.localHosts ?? 0),
              remote: String(conflict?.remoteHosts ?? 0),
            })}
          </Text>
          {updatedAt ? (
            <Text className="mt-1 text-xs text-muted">
              {t("sync.conflictRemoteUpdated", { when: updatedAt })}
            </Text>
          ) : null}
          <View className="mt-5 gap-3">
            <Button
              label={t("sync.keepLocal")}
              variant="accent"
              onPress={keepLocal}
              loading={resolving}
              testID="conflict-keep-local"
            />
            <Button
              label={t("sync.takeRemote")}
              variant="outline"
              onPress={takeRemote}
              disabled={resolving}
              testID="conflict-take-remote"
            />
          </View>
        </View>
      </View>
    </Modal>
  );
}
