import type { ReactNode } from "react";
import { KeyboardAvoidingView, Modal, Platform, Pressable, View } from "react-native";

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
export function Sheet({ visible, onClose, children, testID }: SheetProps) {
  return (
    <Modal
      visible={visible}
      transparent
      animationType="slide"
      onRequestClose={onClose}
      testID={testID}
    >
      <KeyboardAvoidingView
        behavior={Platform.OS === "ios" ? "padding" : undefined}
        className="flex-1 justify-end"
      >
        <Pressable
          accessibilityRole="button"
          accessibilityLabel="Dismiss"
          onPress={onClose}
          className="absolute inset-0 bg-black/60"
        />
        <View className="rounded-t-[20px] border-t border-border bg-card px-5 pt-4 pb-9">
          <View className="mb-4 h-1 w-9 self-center rounded-full bg-border" />
          {children}
        </View>
      </KeyboardAvoidingView>
    </Modal>
  );
}
