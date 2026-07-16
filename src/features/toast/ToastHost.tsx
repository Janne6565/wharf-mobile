import { AlertCircle, Check, Info } from "lucide-react-native";
import { useTranslation } from "react-i18next";
import { Animated, Pressable, Text, View } from "react-native";
import { useSafeAreaInsets } from "react-native-safe-area-context";
import { useAppSelector } from "@/store/hooks";
import type { Toast, ToastKind } from "@/store/toastSlice";
import { colors } from "@/theme/colors";
import { useToastItemLogic } from "./useToastItemLogic";

const ICON = {
  success: Check,
  error: AlertCircle,
  info: Info,
} as const;

const ICON_COLOR: Record<ToastKind, string> = {
  success: colors.ok,
  error: colors.danger,
  info: colors.dim,
};

function ToastItem({ toast }: { readonly toast: Toast }) {
  const { t } = useTranslation();
  const { opacity, dismiss } = useToastItemLogic(toast.id);
  const Icon = ICON[toast.kind];
  // The stored key is a valid resource key, but the strict `t()` overload wants
  // the exact interpolation params per key; a dynamic key can't prove that, so we
  // call through a loosened signature.
  const translate = t as (key: string, options?: Record<string, string>) => string;
  return (
    <Animated.View style={{ opacity }}>
      <Pressable
        onPress={dismiss}
        accessibilityRole="button"
        className="mt-2 flex-row items-center gap-2.5 rounded-field border border-border bg-surface px-3.5 py-3"
        testID="toast"
      >
        <Icon size={17} color={ICON_COLOR[toast.kind]} />
        <Text className="flex-1 text-[13px] text-fg">
          {translate(toast.messageKey, toast.params)}
        </Text>
      </Pressable>
    </Animated.View>
  );
}

// Renders the toast queue as a stack floating above the tab bar. The container is
// non-interactive (touches pass through to the screen); only the toast cards
// themselves catch a tap to dismiss. Mounted once at the app root, inside the
// Redux + safe-area providers.
export function ToastHost() {
  const toasts = useAppSelector((state) => state.toast.toasts);
  const insets = useSafeAreaInsets();
  if (toasts.length === 0) {
    return null;
  }
  return (
    <View
      pointerEvents="box-none"
      style={{ position: "absolute", left: 12, right: 12, bottom: insets.bottom + 12 }}
    >
      {toasts.map((toast) => (
        <ToastItem key={toast.id} toast={toast} />
      ))}
    </View>
  );
}
