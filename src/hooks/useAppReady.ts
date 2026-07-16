import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
  useFonts,
} from "@expo-google-fonts/jetbrains-mono";
import { useEffect, useState } from "react";
import { loadPersistedLanguage } from "@/i18n/config";
import { loadPersistedAccent } from "@/theme/accentStorage";

// Gates the splash screen: the app is "ready" once the JetBrains Mono weights are
// loaded and the persisted settings (language + accent) have been hydrated. The
// root layout hides the native splash on the returned flag.
export function useAppReady(): boolean {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  const [settingsLoaded, setSettingsLoaded] = useState(false);

  useEffect(() => {
    void Promise.all([loadPersistedLanguage(), loadPersistedAccent()]).finally(() =>
      setSettingsLoaded(true),
    );
  }, []);

  return fontsLoaded && settingsLoaded;
}
