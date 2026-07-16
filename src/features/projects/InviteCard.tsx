import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, Card } from "@/components";
import type { InviteView } from "@/sync/projectTypes";

interface InviteCardProps {
  readonly invite: InviteView;
  readonly onAccept: (inviteId: string) => void;
  readonly onDecline: (inviteId: string) => void;
  readonly busy: boolean;
}

// A pending-invite banner: project name, who invited you, and accept/decline
// actions. `busy` (gated on the acted-on invite id) spins both buttons while the
// response is in flight.
export function InviteCard({ invite, onAccept, onDecline, busy }: InviteCardProps) {
  const { t } = useTranslation();
  return (
    <Card className="mb-2 border border-border p-4">
      <Text className="text-[15px] font-semibold text-fg">{invite.projectName}</Text>
      <Text className="mt-0.5 text-xs text-muted">
        {t("projects.invitedBy", { email: invite.invitedByEmail })}
      </Text>
      <View className="mt-3 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t("projects.accept")}
            variant="accent"
            loading={busy}
            onPress={() => onAccept(invite.id)}
          />
        </View>
        <View className="flex-1">
          <Button
            label={t("projects.decline")}
            variant="outline"
            loading={busy}
            onPress={() => onDecline(invite.id)}
          />
        </View>
      </View>
    </Card>
  );
}
