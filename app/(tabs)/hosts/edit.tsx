import { ChevronLeft } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Pressable, Text, View } from "react-native";
import { Button, ScreenContainer } from "@/components";
import { HostFormFields, useHostFormLogic } from "@/features/hostForm";
import { useAccentColor } from "@/theme/useAccentColor";

// Add/edit host form (the mock's `+` button, and the host-detail Edit action).
// Add mode when routed without a hostId; edit mode seeds from the vault slice.
export default function HostEditScreen() {
  const { t } = useTranslation();
  const accent = useAccentColor();
  const { form, isEdit, onSubmit, cancel, canSubmit, isSaving, rootError } = useHostFormLogic();

  return (
    <ScreenContainer>
      <Pressable
        onPress={cancel}
        accessibilityRole="button"
        className="-ml-1 flex-row items-center py-2"
      >
        <ChevronLeft size={22} color={accent} />
        <Text className="text-[15px] text-accent">{t("hostForm.cancel")}</Text>
      </Pressable>
      <Text className="mt-1 mb-5 font-mono-bold text-2xl text-fg">
        {isEdit ? t("hostForm.editTitle") : t("hostForm.addTitle")}
      </Text>
      <HostFormFields form={form} />
      {rootError ? <Text className="mt-3 text-xs text-danger">{rootError}</Text> : null}
      <View className="mt-6">
        <Button
          label={t("hostForm.save")}
          variant="accent"
          onPress={onSubmit}
          disabled={!canSubmit}
          loading={isSaving}
          testID="host-form-save"
        />
      </View>
    </ScreenContainer>
  );
}
