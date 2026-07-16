import "../global.css";
// Installs btoa/atob on Hermes (no-op on Node/web) before any crypto runs.
import "@/lib/base64Polyfill";
import "@/i18n/config";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { bootstrapSession } from "@/auth/session";
import { useAppReady } from "@/hooks/useAppReady";
import { useLockOnBackground } from "@/hooks/useLockOnBackground";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";
import { useAppSelector } from "@/store/hooks";
import { colors } from "@/theme/colors";

// Keep the native splash up until fonts, language AND the session bootstrap
// (silent refresh) are ready — so a signed-in user never flashes the sign-in
// screen on launch.
void SplashScreen.preventAutoHideAsync();

// The route tree behind auth guards (expo-router SDK 57 idiom: Stack.Protected
// groups; when a guard flips false its screens unmount and the router redirects
// to the anchor — app/index.tsx — which re-routes by state):
//   anonymous               → sign-in / pair
//   authenticated + locked  → unlock
//   authenticated + open    → the (tabs) shell
// Lives inside the Redux Provider so it can read the derived auth/vault state.
function RootNavigator() {
  const ready = useAppReady();
  const authStatus = useAppSelector((state) => state.auth.status);
  const vaultStatus = useAppSelector((state) => state.vault.status);
  useLockOnBackground();

  useEffect(() => {
    void bootstrapSession();
  }, []);

  const resolved = ready && authStatus !== "unknown";

  useEffect(() => {
    if (resolved) {
      void SplashScreen.hideAsync();
    }
  }, [resolved]);

  if (!resolved) {
    return null;
  }

  const isAuthenticated = authStatus === "authenticated";
  const isUnlocked = vaultStatus === "unlocked";

  return (
    <Stack
      screenOptions={{
        headerShown: false,
        contentStyle: { backgroundColor: colors.shell },
      }}
    >
      <Stack.Protected guard={!isAuthenticated}>
        <Stack.Screen name="sign-in" />
        <Stack.Screen name="pair" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && !isUnlocked}>
        <Stack.Screen name="unlock" />
      </Stack.Protected>
      <Stack.Protected guard={isAuthenticated && isUnlocked}>
        <Stack.Screen name="(tabs)" />
      </Stack.Protected>
    </Stack>
  );
}

export default function RootLayout() {
  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.shell }}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <RootNavigator />
          </SafeAreaProvider>
        </QueryClientProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
