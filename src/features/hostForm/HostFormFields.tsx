import { Controller, type UseFormReturn } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { Text, View } from "react-native";
import { FormField } from "@/components";
import type { HostFormValues } from "./lib";

interface HostFormFieldsProps {
  readonly form: UseFormReturn<HostFormValues>;
}

// The five editable host fields (name/user/address/port/tags), bound to
// react-hook-form. Auth mode + password are deliberately NOT here: the mobile
// form owns only these fields and preserves any stored auth secrets untouched.
export function HostFormFields({ form }: HostFormFieldsProps) {
  const { t } = useTranslation();
  return (
    <View className="gap-4">
      <Controller
        control={form.control}
        name="name"
        render={({ field, fieldState }) => (
          <FormField
            label={t("hostForm.nameLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t("hostForm.namePlaceholder")}
            error={fieldState.error?.message}
            testID="host-form-name"
          />
        )}
      />
      <Controller
        control={form.control}
        name="user"
        render={({ field, fieldState }) => (
          <FormField
            label={t("hostForm.userLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t("hostForm.userPlaceholder")}
            error={fieldState.error?.message}
            testID="host-form-user"
          />
        )}
      />
      <Controller
        control={form.control}
        name="address"
        render={({ field, fieldState }) => (
          <FormField
            label={t("hostForm.addressLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t("hostForm.addressPlaceholder")}
            keyboardType="url"
            error={fieldState.error?.message}
            testID="host-form-address"
          />
        )}
      />
      <Controller
        control={form.control}
        name="port"
        render={({ field, fieldState }) => (
          <FormField
            label={t("hostForm.portLabel")}
            value={field.value}
            onChangeText={field.onChange}
            onBlur={field.onBlur}
            placeholder={t("hostForm.portPlaceholder")}
            keyboardType="number-pad"
            error={fieldState.error?.message}
            testID="host-form-port"
          />
        )}
      />
      <Controller
        control={form.control}
        name="tags"
        render={({ field, fieldState }) => (
          <View>
            <FormField
              label={t("hostForm.tagsLabel")}
              value={field.value}
              onChangeText={field.onChange}
              onBlur={field.onBlur}
              placeholder={t("hostForm.tagsPlaceholder")}
              error={fieldState.error?.message}
              testID="host-form-tags"
            />
            <Text className="mt-1.5 text-xs text-muted">{t("hostForm.tagsHint")}</Text>
          </View>
        )}
      />
    </View>
  );
}
