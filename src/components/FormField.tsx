import { Text, TextInput, type TextInputProps, View } from "react-native";
import { cn } from "@/lib/cn";
import { colors } from "@/theme/colors";

interface FormFieldProps {
  readonly label: string;
  readonly value: string;
  readonly onChangeText: (text: string) => void;
  readonly error?: string;
  readonly placeholder?: string;
  readonly secureTextEntry?: boolean;
  readonly autoCapitalize?: TextInputProps["autoCapitalize"];
  readonly autoComplete?: TextInputProps["autoComplete"];
  readonly keyboardType?: TextInputProps["keyboardType"];
  readonly autoCorrect?: boolean;
  readonly maxLength?: number;
  readonly onBlur?: () => void;
  readonly onSubmitEditing?: () => void;
  readonly testID?: string;
}

// The shared labelled input for all forms (REACT.md: never raw input + label
// pairs). Dark field styled like the mock's search shell, with a muted label
// above and a danger-red validation message below when `error` is set.
export function FormField({
  label,
  value,
  onChangeText,
  error,
  placeholder,
  secureTextEntry,
  autoCapitalize = "none",
  autoComplete,
  keyboardType,
  autoCorrect = false,
  maxLength,
  onBlur,
  onSubmitEditing,
  testID,
}: FormFieldProps) {
  return (
    <View>
      <Text className="mb-1.5 text-xs font-semibold uppercase tracking-widest text-muted">
        {label}
      </Text>
      <TextInput
        className={cn(
          "h-12 rounded-field border bg-surface px-3.5 font-mono text-[15px] text-fg",
          error ? "border-danger" : "border-border",
        )}
        value={value}
        onChangeText={onChangeText}
        onBlur={onBlur}
        onSubmitEditing={onSubmitEditing}
        placeholder={placeholder}
        placeholderTextColor={colors.muted}
        secureTextEntry={secureTextEntry}
        autoCapitalize={autoCapitalize}
        autoComplete={autoComplete}
        keyboardType={keyboardType}
        autoCorrect={autoCorrect}
        maxLength={maxLength}
        testID={testID}
      />
      {error ? <Text className="mt-1.5 text-xs text-danger">{error}</Text> : null}
    </View>
  );
}
