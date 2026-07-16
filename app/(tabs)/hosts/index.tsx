import { Fragment } from "react";
import { useTranslation } from "react-i18next";
import { View } from "react-native";
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
import { useHostsLogic } from "@/features/hosts/useHostsLogic";

export default function HostsScreen() {
  const { t } = useTranslation();
  const { personalHosts } = useHostsLogic();

  return (
    <ScreenContainer>
      <ScreenTitle title={t("hosts.title")} action={<AddButton />} />
      <View className="mt-3.5">
        <SearchField placeholder={t("hosts.search")} />
      </View>
      <View className="mt-5">
        <SectionLabel>{t("hosts.sectionPersonal")}</SectionLabel>
        <Card>
          {personalHosts.map((host, index) => (
            <Fragment key={host.id}>
              {index > 0 ? <RowDivider /> : null}
              <HostRow name={host.name} target={host.target} status={host.status} />
            </Fragment>
          ))}
        </Card>
      </View>
    </ScreenContainer>
  );
}
