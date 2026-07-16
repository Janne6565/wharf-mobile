import { Copy, Fingerprint, ShieldCheck } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Card, ScreenContainer, ScreenTitle, SectionLabel } from "@/components";
import type { KeyIdentity } from "@/features/keys/useKeysLogic";
import { useKeysLogic } from "@/features/keys/useKeysLogic";
import { colors } from "@/theme/colors";
import { useAccentColor } from "@/theme/useAccentColor";

function SshNote() {
  const { t } = useTranslation();
  return (
    <View className="mt-5 flex-row items-start gap-2 rounded-field border border-borderSoft bg-surface px-3 py-2.5">
      <ShieldCheck size={16} color={colors.muted} />
      <Text className="flex-1 text-xs leading-5 text-muted">{t("keys.sshNote")}</Text>
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
          <Text className="text-xs text-muted">{t("keys.createdAt", { date: created })}</Text>
          <View className="mt-3 flex-row items-center gap-2">
            <Fingerprint size={15} color={colors.dim} />
            <Text className="text-xs text-muted">{t("keys.fingerprintLabel")}</Text>
          </View>
          <Text className="mt-1 font-mono text-[13px] text-fgSoft">{identity.fingerprint}</Text>
          <Pressable
            onPress={onCopy}
            accessibilityRole="button"
            className="mt-3 flex-row items-center gap-1.5"
            testID="keys-copy"
          >
            <Copy size={15} color={accent} />
            <Text className="text-[13px] text-accent">{t("keys.copy")}</Text>
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
  const { identity, copyPublicKey } = useKeysLogic();

  return (
    <ScreenContainer>
      <ScreenTitle title={t("keys.title")} />
      {identity ? <IdentityCard identity={identity} onCopy={copyPublicKey} /> : <EmptyState />}
      <SshNote />
    </ScreenContainer>
  );
}
