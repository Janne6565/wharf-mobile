import { useEffect, useRef } from "react";
import { Animated } from "react-native";
import { useAppDispatch } from "@/store/hooks";
import { dismissToast } from "@/store/toastSlice";

// How long a toast stays on screen before it auto-dismisses, and the fade
// duration for the enter/exit transitions.
const VISIBLE_MS = 3200;
const FADE_MS = 180;

// Drives a single toast: a fade-in on mount, an auto-dismiss timer, and a
// fade-out before the entry is removed from the queue. Kept framework-thin so
// <ToastItem> only renders.
export function useToastItemLogic(id: number) {
  const dispatch = useAppDispatch();
  const opacity = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    Animated.timing(opacity, {
      toValue: 1,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start();

    const timer = setTimeout(() => {
      Animated.timing(opacity, {
        toValue: 0,
        duration: FADE_MS,
        useNativeDriver: true,
      }).start(() => dispatch(dismissToast(id)));
    }, VISIBLE_MS);

    return () => clearTimeout(timer);
  }, [id, opacity, dispatch]);

  const dismiss = () => {
    Animated.timing(opacity, {
      toValue: 0,
      duration: FADE_MS,
      useNativeDriver: true,
    }).start(() => dispatch(dismissToast(id)));
  };

  return { opacity, dismiss };
}
