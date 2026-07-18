import { Copy } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Card, RowDivider, SectionLabel } from "@/components";
import type { SyncedKeyView } from "@/features/keys/useKeysLogic";
import { hexToRgba } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";

// A single synced-key row: an accent type pill (lowercased, like the identity
// card's), the key name in mono, the OpenSSH fingerprint, and a copy-public-key
// action — the fingerprint line and the copy action are shown only when the key
// carries a public half.
function KeyRow({
  item,
  onCopy,
}: {
  readonly item: SyncedKeyView;
  readonly onCopy: (publicKey: string) => void;
}) {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const publicKey = item.publicKey;
  return (
    <View className="px-4 py-3.5">
      <View className="flex-row items-center gap-2">
        <Text
          className="rounded-full border px-2.5 py-1 font-mono text-[11px] text-accent"
          style={{ backgroundColor: hexToRgba(accent, 0.12), borderColor: hexToRgba(accent, 0.35) }}
        >
          {item.type.toLowerCase()}
        </Text>
        <Text className="flex-1 font-mono text-[13px] text-fg" numberOfLines={1}>
          {item.name}
        </Text>
      </View>
      {item.fingerprint ? (
        <Text className="mt-2 font-mono text-[11px] leading-4 text-muted" numberOfLines={1}>
          {item.fingerprint}
        </Text>
      ) : null}
      {publicKey ? (
        <Pressable
          onPress={() => onCopy(publicKey)}
          accessibilityRole="button"
          className="mt-2.5 flex-row items-center gap-1.5"
          testID={`keys-copy-${item.id}`}
        >
          <Copy size={14} color={accent} />
          <Text className="text-[13px] font-semibold text-accent">{t("keys.copy")}</Text>
        </Pressable>
      ) : null}
    </View>
  );
}

export function SyncedKeysSection({
  keys,
  onCopy,
}: {
  readonly keys: readonly SyncedKeyView[];
  readonly onCopy: (publicKey: string) => void;
}) {
  const { t } = useTranslation();
  return (
    <View className="mt-5">
      <SectionLabel>{t("keys.syncedTitle")}</SectionLabel>
      <Card>
        {keys.map((item, index) => (
          <View key={item.id}>
            {index > 0 ? <RowDivider /> : null}
            <KeyRow item={item} onCopy={onCopy} />
          </View>
        ))}
      </Card>
    </View>
  );
}
