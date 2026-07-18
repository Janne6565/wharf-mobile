import { useCallback, useEffect, useRef, useState } from "react";
import { Animated, Easing, type LayoutChangeEvent } from "react-native";

// Slide distance used before the card has been measured (onLayout). Any value
// taller than a realistic sheet works — the card just starts fully off-screen.
const FALLBACK_OFFSET = 600;
const BACKDROP_MS = 180;
const CARD_IN_MS = 260;
const EXIT_MS = 180;

// Drives the Sheet's entry/exit: the backdrop fades (opacity) while the card
// slides (translateY) from its own measured height. The card height feeds the
// slide distance, so the card travels exactly its own height and no further.
export function useSheetAnimation(visible: boolean) {
  const [exiting, setExiting] = useState(false);
  const backdropOpacity = useRef(new Animated.Value(0)).current;
  const translateY = useRef(new Animated.Value(FALLBACK_OFFSET)).current;
  const cardHeight = useRef(FALLBACK_OFFSET);
  // Only run the exit animation for a sheet that was actually opened.
  const wasOpen = useRef(false);

  const onCardLayout = useCallback((event: LayoutChangeEvent) => {
    const { height } = event.nativeEvent.layout;
    if (height > 0) {
      cardHeight.current = height;
    }
  }, []);

  useEffect(() => {
    if (visible) {
      wasOpen.current = true;
      setExiting(false);
      translateY.setValue(cardHeight.current);
      Animated.parallel([
        Animated.timing(backdropOpacity, {
          toValue: 1,
          duration: BACKDROP_MS,
          useNativeDriver: true,
        }),
        Animated.timing(translateY, {
          toValue: 0,
          duration: CARD_IN_MS,
          easing: Easing.out(Easing.cubic),
          useNativeDriver: true,
        }),
      ]).start();
      return;
    }
    if (!wasOpen.current) {
      return;
    }
    // Keep the Modal mounted through the exit, then unmount via `exiting`.
    setExiting(true);
    Animated.parallel([
      Animated.timing(backdropOpacity, {
        toValue: 0,
        duration: EXIT_MS,
        useNativeDriver: true,
      }),
      Animated.timing(translateY, {
        toValue: cardHeight.current,
        duration: EXIT_MS,
        easing: Easing.in(Easing.cubic),
        useNativeDriver: true,
      }),
    ]).start(() => {
      // Unmount once the exit settles. We intentionally don't gate on `finished`:
      // the only thing that interrupts this animation is a re-open, and that path
      // sets visible=true, which keeps the Modal mounted via `visible || exiting`.
      setExiting(false);
    });
  }, [visible, backdropOpacity, translateY]);

  return { exiting, backdropOpacity, translateY, onCardLayout };
}
