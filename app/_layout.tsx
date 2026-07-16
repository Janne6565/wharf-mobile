import "../global.css";
import "@/i18n/config";

import { QueryClientProvider } from "@tanstack/react-query";
import { Stack } from "expo-router";
import * as SplashScreen from "expo-splash-screen";
import { StatusBar } from "expo-status-bar";
import { useEffect } from "react";
import { GestureHandlerRootView } from "react-native-gesture-handler";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { useAppReady } from "@/hooks/useAppReady";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";
import { colors } from "@/theme/colors";

// Keep the native splash up until fonts + persisted language are ready.
void SplashScreen.preventAutoHideAsync();

export default function RootLayout() {
  const ready = useAppReady();

  useEffect(() => {
    if (ready) {
      void SplashScreen.hideAsync();
    }
  }, [ready]);

  if (!ready) {
    return null;
  }

  return (
    <GestureHandlerRootView style={{ flex: 1, backgroundColor: colors.shell }}>
      <Provider store={store}>
        <QueryClientProvider client={queryClient}>
          <SafeAreaProvider>
            <StatusBar style="light" />
            <Stack
              screenOptions={{
                headerShown: false,
                contentStyle: { backgroundColor: colors.shell },
              }}
            >
              <Stack.Screen name="(tabs)" />
            </Stack>
          </SafeAreaProvider>
        </QueryClientProvider>
      </Provider>
    </GestureHandlerRootView>
  );
}
