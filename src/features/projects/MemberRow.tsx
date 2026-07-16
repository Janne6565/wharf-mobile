import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import type { ProjectMember } from "@/api/generated/model";
import { Avatar, RoleChip } from "@/components";
import { avatarInitials, ROLE_LABEL_KEY } from "./lib";

interface MemberRowProps {
  readonly member: ProjectMember;
  readonly isYou: boolean;
}

// A member row in the project detail members card: initials avatar, email (with a
// "(you)" tag for the caller), and the role as plain right-aligned text (mock).
export function MemberRow({ member, isYou }: MemberRowProps) {
  const { t } = useTranslation();
  const email = member.email ?? "";
  const role = member.role === "OWNER" || member.role === "ADMIN" ? member.role : "MEMBER";
  return (
    <View className="flex-row items-center gap-3 px-4 py-3">
      <Avatar initials={avatarInitials(email)} />
      <Text className="min-w-0 flex-1 text-[15px] text-fg" numberOfLines={1}>
        {email}
        {isYou ? <Text className="text-muted"> {t("projectDetail.you")}</Text> : null}
      </Text>
      <RoleChip label={t(ROLE_LABEL_KEY[role])} />
    </View>
  );
}
