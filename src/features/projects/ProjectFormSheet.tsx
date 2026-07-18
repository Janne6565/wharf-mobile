import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { Button, FormField, Sheet } from "@/components";
import { useProjectFormSheetLogic } from "./useProjectFormSheetLogic";

const NAME_MAX_LENGTH = 100;
const DESCRIPTION_MAX_LENGTH = 500;

interface ProjectFormSheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly title: string;
  readonly submitLabel: string;
  readonly initialName: string;
  readonly initialDescription: string;
  readonly saving: boolean;
  readonly onSubmit: (name: string, description: string) => void;
  readonly errorText?: string;
  readonly testID?: string;
}

// The shared project create/edit sheet: a name field (required, ≤100) and an
// optional description field (≤500). Submit is gated on a non-empty name only
// (no format gating per REACT.md); the sheet is reused for both create and edit,
// with the title, submit label and initial values passed in by the parent.
export function ProjectFormSheet({
  visible,
  onClose,
  title,
  submitLabel,
  initialName,
  initialDescription,
  saving,
  onSubmit,
  errorText,
  testID,
}: ProjectFormSheetProps) {
  const { t } = useTranslation();
  const { name, setName, description, setDescription, canSubmit } = useProjectFormSheetLogic({
    visible,
    initialName,
    initialDescription,
  });
  const submit = () => onSubmit(name.trim(), description.trim());

  return (
    <Sheet visible={visible} onClose={onClose} testID={testID ?? "project-form-sheet"}>
      <Text className="text-lg font-semibold text-fg">{title}</Text>
      <View className="mt-4">
        <FormField
          label={t("projects.createName")}
          value={name}
          onChangeText={setName}
          maxLength={NAME_MAX_LENGTH}
          autoCapitalize="sentences"
          testID="project-name"
        />
      </View>
      <View className="mt-4">
        <FormField
          label={t("projects.createDescription")}
          value={description}
          onChangeText={setDescription}
          maxLength={DESCRIPTION_MAX_LENGTH}
          autoCapitalize="sentences"
          testID="project-description"
        />
      </View>
      {errorText ? <Text className="mt-3 text-xs text-danger">{errorText}</Text> : null}
      <View className="mt-5 flex-row gap-3">
        <View className="flex-1">
          <Button
            label={t("projects.formCancel")}
            variant="outline"
            onPress={onClose}
            testID="project-cancel"
          />
        </View>
        <View className="flex-1">
          <Button
            label={submitLabel}
            variant="accent"
            onPress={submit}
            loading={saving}
            disabled={!canSubmit}
            testID="project-submit"
          />
        </View>
      </View>
    </Sheet>
  );
}
