import { Text } from "react-native";

interface SectionLabelProps {
  readonly children: string;
}

// Uppercase, wide-tracked grouped-list header (e.g. PERSONAL, MEMBERS, HOSTS).
export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <Text className="mb-2 text-xs font-semibold uppercase tracking-widest text-muted">
      {children}
    </Text>
  );
}
