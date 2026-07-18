import type { ReactNode } from "react";
import { Animated, KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";
import { useSheetAnimation } from "./useSheetAnimation";

interface SheetProps {
  readonly visible: boolean;
  readonly onClose: () => void;
  readonly children: ReactNode;
  readonly testID?: string;
}

// A bottom sheet built on RN's Modal: a dimmed backdrop (tap to dismiss) with a
// rounded card slid up from the bottom, styled to the mock's dark shell. Keeps
// clear of the keyboard so a focused field stays visible. Used for the M5 invite
// sheet; generic enough for future sheets.
//
// animationType="none" + a self-driven Animated animation is deliberate: the
// stock "slide" animation slides the WHOLE modal (backdrop included) up, so the
// dark overlay visibly slides over the screen. We want the backdrop to FADE
// while only the card slides, so we drive both values ourselves. The Modal is
// kept mounted through the exit (visible || exiting) so the close animation can
// play before unmount.
export function Sheet({ visible, onClose, children, testID }: SheetProps) {
  const { exiting, backdropOpacity, translateY, onCardLayout } = useSheetAnimation(visible);

  return (
    <Modal
      visible={visible || exiting}
      transparent
      animationType="none"
      onRequestClose={onClose}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
      >
        <Animated.View
          className="absolute inset-0 bg-black/60"
          style={{ opacity: backdropOpacity }}
        >
          <Pressable
            accessibilityRole="button"
            accessibilityLabel="Dismiss"
            onPress={onClose}
            className="flex-1"
          />
        </Animated.View>
        <Animated.View
          onLayout={onCardLayout}
          style={{ transform: [{ translateY }] }}
          className="rounded-t-[20px] border-t border-border bg-card px-5 pt-4 pb-9"
        >
          <View className="mb-4 h-1 w-9 self-center rounded-full bg-border" />
          {children}
        </Animated.View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
