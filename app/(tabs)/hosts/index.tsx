import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import {
  AddButton,
  Card,
  HostRow,
  RowDivider,
  ScreenContainer,
  ScreenTitle,
  SearchField,
  SectionLabel,
} from "@/components";
import { type HostSectionData, useHostsLogic } from "@/features/hosts/useHostsLogic";
import { SyncStatusBanner } from "@/features/syncStatus/SyncStatusBanner";

function HostSection({
  section,
  onOpenHost,
}: {
  readonly section: HostSectionData;
  readonly onOpenHost: (hostId: string, projectId?: string) => void;
}) {
  const { t } = useTranslation();
  if (section.hosts.length === 0) {
    return null;
  }
  const label = section.kind === "personal" ? t("hosts.sectionPersonal") : (section.name ?? "");
  return (
    <View className="mt-5">
      <SectionLabel>{label}</SectionLabel>
      <Card>
        {section.hosts.map((host, index) => (
          <Fragment key={host.id}>
            {index > 0 ? <RowDivider /> : null}
            <HostRow
              name={host.name}
              target={host.target}
              status={host.status}
              rttMs={host.rttMs}
              onPress={() => onOpenHost(host.id, host.projectId)}
            />
          </Fragment>
        ))}
      </Card>
    </View>
  );
}

function EmptyState({ title, body }: { readonly title: string; readonly body?: string }) {
  return (
    <View className="mt-16 items-center px-6">
      <Text className="text-center text-lg font-semibold text-fg">{title}</Text>
      {body ? <Text className="mt-2 text-center text-sm text-muted">{body}</Text> : null}
    </View>
  );
}

export default function HostsScreen() {
  const { t } = useTranslation();
  const { sections, query, setQuery, openHost, openAddHost, hasHosts, hasMatches } =
    useHostsLogic();

  return (
    <ScreenContainer>
      <ScreenTitle
        title={t("hosts.title")}
        action={<AddButton onPress={openAddHost} testID="hosts-add" />}
      />
      <View className="mt-3.5">
        <SearchField placeholder={t("hosts.search")} value={query} onChangeText={setQuery} />
      </View>
      <SyncStatusBanner />
      {!hasHosts ? (
        <EmptyState title={t("hosts.empty")} body={t("hosts.emptyBody")} />
      ) : !hasMatches ? (
        <EmptyState title={t("hosts.noMatches")} />
      ) : (
        sections.map((section) => (
          <HostSection key={section.key} section={section} onOpenHost={openHost} />
        ))
      )}
    </ScreenContainer>
  );
}
