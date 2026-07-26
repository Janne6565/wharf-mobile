import { ShieldAlert } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button } from "@/components";
import { colors } from "@/theme/colors";
import { hexToRgba } from "@/theme/effects";
import type { IdentityMismatch } from "@/vault/identityMismatch";

interface KeyMismatchWarningProps {
  readonly mismatch: IdentityMismatch;
  readonly onRepublish: () => void;
  readonly republishing: boolean;
}

// One labelled fingerprint block — the `well` inset the Keys tab uses, so the two
// fingerprints read as the same kind of value the user compares elsewhere.
function FingerprintBlock({ label, value }: { readonly label: string; readonly value: string }) {
  return (
    <View className="mt-3">
      <Text className="text-xs text-muted">{label}</Text>
      <View className="mt-1.5 rounded-tile border border-borderFaint bg-well px-3.5 py-3">
        <Text className="font-mono text-xs leading-5 text-fgSoft">{value}</Text>
      </View>
    </View>
  );
}

// The mismatch warning: the server publishes a public key for this account that is
// not the one in this vault, which means project DEKs sealed "to this account" may
// be readable by whoever supplied that key. Deliberately NOT dismissable — it is
// the only visible symptom of a key substitution, and the alternative (projects
// stuck in awaiting-access) looks like an ordinary pending state. Both
// fingerprints are shown, labelled, so the user can compare them against another
// Wharf client before acting.
export function KeyMismatchWarning({
  mismatch,
  onRepublish,
  republishing,
}: KeyMismatchWarningProps) {
  const { t } = useTranslation();
  return (
    <View
      testID="key-mismatch-warning"
      className="mt-3 rounded-card px-4 py-3.5"
      style={{
        borderWidth: 1,
        borderColor: hexToRgba(colors.danger, 0.45),
        backgroundColor: hexToRgba(colors.danger, 0.08),
      }}
    >
      <View className="flex-row items-center gap-2">
        <ShieldAlert size={18} color={colors.danger} />
        <Text className="flex-1 text-[15px] font-semibold text-fg">
          {t("projects.keyMismatch.title")}
        </Text>
      </View>
      <Text className="mt-2 text-[12.5px] leading-5 text-fgSoft">
        {t("projects.keyMismatch.body")}
      </Text>
      <FingerprintBlock
        label={t("projects.keyMismatch.localLabel")}
        value={mismatch.localFingerprint}
      />
      <FingerprintBlock
        label={t("projects.keyMismatch.serverLabel")}
        value={mismatch.serverFingerprint}
      />
      <Text className="mt-3 text-xs leading-5 text-muted">
        {t("projects.keyMismatch.compareHint")}
      </Text>
      <View className="mt-3">
        <Button
          label={t("projects.keyMismatch.republish")}
          variant="danger"
          size="sm"
          loading={republishing}
          onPress={onRepublish}
          testID="key-mismatch-republish"
        />
      </View>
    </View>
  );
}
