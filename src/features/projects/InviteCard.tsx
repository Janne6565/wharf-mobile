import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, Card } from "@/components";
import type { InviteView } from "@/sync/projectTypes";
import { hexToRgba } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";

interface InviteCardProps {
  readonly invite: InviteView;
  readonly onAccept: (inviteId: string) => void;
  readonly onDecline: (inviteId: string) => void;
  readonly busy: boolean;
}

// A pending-invite banner (screen 06 "INVITE" card): an accent overline, the
// project name, who invited you, and accept/decline actions. The accent-tinted
// border and glow are applied on an outer wrapper — Card takes no style prop and
// its border/shadow are fixed — with Card's own border neutralised so only the
// accent outline shows. `busy` (gated on the acted-on invite id) spins both
// buttons while the response is in flight.
export function InviteCard({ invite, onAccept, onDecline, busy }: InviteCardProps) {
  const { t } = useTranslation();
  const accent = useAccentColor();
  return (
    <View
      className="mb-2 rounded-card"
      style={{
        borderWidth: 1,
        borderColor: hexToRgba(accent, 0.35),
        boxShadow: `0 0 24px ${hexToRgba(accent, 0.08)}`,
      }}
    >
      <Card className="border-transparent p-4">
        <Text className="font-mono text-[11px] uppercase tracking-widest text-accent">
          {t("projects.inviteBadge")}
        </Text>
        <Text className="mt-1.5 text-[15px] font-semibold text-fg">{invite.projectName}</Text>
        <Text className="mt-0.5 text-[12.5px] text-muted">
          {t("projects.invitedBy", { email: invite.invitedByEmail })}
        </Text>
        <View className="mt-3 flex-row gap-2.5">
          <View className="flex-1">
            <Button
              label={t("projects.accept")}
              variant="accent"
              size="sm"
              loading={busy}
              onPress={() => onAccept(invite.id)}
            />
          </View>
          <View className="flex-1">
            <Button
              label={t("projects.decline")}
              variant="outline"
              size="sm"
              loading={busy}
              onPress={() => onDecline(invite.id)}
            />
          </View>
        </View>
      </Card>
    </View>
  );
}
