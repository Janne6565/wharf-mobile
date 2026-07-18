import { Text } from "react-native";

interface SectionLabelProps {
  readonly children: string;
}

// Mono, uppercase, wide-tracked grouped-list header (e.g. PERSONAL, MEMBERS,
// HOSTS). v2 renders these in the mono type family.
export function SectionLabel({ children }: SectionLabelProps) {
  return (
    <Text className="mb-2 font-mono text-[11px] uppercase tracking-widest text-muted">
      {children}
    </Text>
  );
}
