import { Pressable, ScrollView, Text } from "react-native";
import { cn } from "@/lib/cn";
import { hexToRgba } from "@/theme/effects";
import { useAccentColor } from "@/theme/useAccentColor";
import type { AccessoryKey, ModifierKey, Modifiers } from "./lib";

// The mock's key accessory row: `esc ⇥ ctrl alt / ~ ↑ ↓` as mono keycaps. The
// terminal glyphs (⇥ ↑ ↓) are the sanctioned REACT.md exception (TUI simulation).
// ctrl/alt are sticky modifiers — highlighted (accent) while armed.
interface KeyAccessoryRowProps {
  readonly modifiers: Modifiers;
  readonly onKey: (key: AccessoryKey) => void;
  readonly onModifier: (which: ModifierKey) => void;
}

interface Keycap {
  readonly label: string;
  readonly accessory?: AccessoryKey;
  readonly modifier?: ModifierKey;
}

const KEYCAPS: readonly Keycap[] = [
  { label: "esc", accessory: "esc" },
  { label: "⇥", accessory: "tab" },
  { label: "ctrl", modifier: "ctrl" },
  { label: "alt", modifier: "alt" },
  { label: "/", accessory: "slash" },
  { label: "~", accessory: "tilde" },
  { label: "↑", accessory: "up" },
  { label: "↓", accessory: "down" },
];

function Cap({
  cap,
  armed,
  accent,
  onKey,
  onModifier,
}: {
  readonly cap: Keycap;
  readonly armed: boolean;
  readonly accent: string;
  readonly onKey: (key: AccessoryKey) => void;
  readonly onModifier: (which: ModifierKey) => void;
}) {
  const onPress = () => {
    if (cap.modifier) {
      onModifier(cap.modifier);
    } else if (cap.accessory) {
      onKey(cap.accessory);
    }
  };
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: armed }}
      onPress={onPress}
      testID={`termkey-${cap.modifier ?? cap.accessory}`}
      className="rounded-[9px] border border-borderInput bg-cardTop px-[11px] py-1.5"
      // Armed modifiers tint with the live accent — derived at runtime since the
      // accent is user-switchable and cannot be baked into a Tailwind token.
      style={
        armed
          ? { backgroundColor: hexToRgba(accent, 0.18), borderColor: hexToRgba(accent, 0.4) }
          : undefined
      }
    >
      <Text className={cn("font-mono text-[13px]", armed ? "text-accent" : "text-fgSoft")}>
        {cap.label}
      </Text>
    </Pressable>
  );
}

export function KeyAccessoryRow({ modifiers, onKey, onModifier }: KeyAccessoryRowProps) {
  const accent = useAccentColor();
  return (
    <ScrollView
      horizontal
      keyboardShouldPersistTaps="always"
      showsHorizontalScrollIndicator={false}
      // RN ScrollView defaults to flexGrow 1, so inside the terminal's flex column it
      // would swallow half the height next to the flex-1 terminal — pin it to its content.
      // The bar chrome (top border + raised bg) lives here, not on the content container:
      // a horizontal ScrollView's content container is only as wide as its keycaps, so the
      // chrome would stop short of the screen edge — on the ScrollView it spans full width.
      className="grow-0 shrink-0 border-t border-termBorder bg-shell"
      // grow (flexGrow:1) makes the content at least viewport-wide so justify-between can
      // spread the keycaps edge-to-edge; when they overflow a narrow screen the gap holds
      // spacing and the row scrolls horizontally as before.
      contentContainerClassName="grow flex-row items-center justify-between gap-1.5 px-2.5 py-2"
    >
      {KEYCAPS.map((cap) => (
        <Cap
          key={cap.label}
          cap={cap}
          armed={Boolean(cap.modifier) && modifiers[cap.modifier as ModifierKey]}
          accent={accent}
          onKey={onKey}
          onModifier={onModifier}
        />
      ))}
    </ScrollView>
  );
}
