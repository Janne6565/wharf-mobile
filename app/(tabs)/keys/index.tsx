import { CircleCheck, Copy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Card, ScreenContainer, ScreenTitle, SectionLabel } from "@/components";
import { SyncedKeysSection } from "@/features/keys/SyncedKeysSection";
import type { KeyIdentity } from "@/features/keys/useKeysLogic";
import { useKeysLogic } from "@/features/keys/useKeysLogic";
import { colors } from "@/theme/colors";
import { hexToRgba } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";

// The identity is the account's X25519 project-encryption keypair (used to unwrap
// project DEKs; see useKeysLogic); KeyIdentity carries no algorithm field, so the
// pill label is a fixed constant.
const IDENTITY_ALGORITHM = "x25519";

function SshNote() {
  const { t } = useTranslation();
  return (
    <View className="mt-5 flex-row items-start gap-2.5 rounded-field border border-borderFaint bg-surface px-3.5 py-3">
      <CircleCheck size={18} color={colors.muted} />
      <Text className="flex-1 text-[12.5px] leading-5 text-muted">{t("keys.sshNote")}</Text>
    </View>
  );
}

function IdentityCard({
  identity,
  onCopy,
}: {
  readonly identity: KeyIdentity;
  readonly onCopy: () => void;
}) {
  const { t, i18n } = useTranslation();
  const accent = useAccentColor();
  const created = new Date(identity.createdAt).toLocaleDateString(i18n.language, {
    year: "numeric",
    month: "short",
    day: "numeric",
  });
  return (
    <View className="mt-5">
      <SectionLabel>{t("keys.identityTitle")}</SectionLabel>
      <Card>
        <View className="px-4 py-3.5">
          <View className="flex-row items-center gap-2">
            <Text
              className="rounded-full border px-2.5 py-1 font-mono text-[11px] text-accent"
              style={{
                backgroundColor: hexToRgba(accent, 0.12),
                borderColor: hexToRgba(accent, 0.35),
              }}
            >
              {IDENTITY_ALGORITHM}
            </Text>
            <Text className="text-xs text-muted">{t("keys.createdAt", { date: created })}</Text>
          </View>
          <Text className="mt-3.5 text-xs text-muted">{t("keys.fingerprintLabel")}</Text>
          <View className="mt-1.5 rounded-tile border border-borderFaint bg-well px-3.5 py-3">
            <Text className="font-mono text-xs leading-5 text-fgSoft">{identity.fingerprint}</Text>
          </View>
          <Pressable
            onPress={onCopy}
            accessibilityRole="button"
            className="mt-3 flex-row items-center gap-1.5"
            testID="keys-copy"
          >
            <Copy size={15} color={accent} />
            <Text className="text-[13.5px] font-semibold text-accent">{t("keys.copy")}</Text>
          </Pressable>
        </View>
      </Card>
    </View>
  );
}

function EmptyState() {
  const { t } = useTranslation();
  return (
    <View className="mt-16 items-center px-6">
      <Text className="text-center text-lg font-semibold text-fg">{t("keys.emptyTitle")}</Text>
      <Text className="mt-2 text-center text-sm text-muted">{t("keys.emptyBody")}</Text>
    </View>
  );
}

export default function KeysScreen() {
  const { t } = useTranslation();
  const { identity, syncedKeys, copyPublicKey, copyKey } = useKeysLogic();

  const hasKeys = syncedKeys.length > 0;
  return (
    <ScreenContainer>
      <ScreenTitle title={t("keys.title")} />
      {hasKeys ? <SyncedKeysSection keys={syncedKeys} onCopy={copyKey} /> : null}
      {identity ? (
        <IdentityCard identity={identity} onCopy={copyPublicKey} />
      ) : hasKeys ? null : (
        <EmptyState />
      )}
      <SshNote />
    </ScreenContainer>
  );
}
