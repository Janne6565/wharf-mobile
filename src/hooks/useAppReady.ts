import {
  JetBrainsMono_400Regular,
  JetBrainsMono_500Medium,
  JetBrainsMono_700Bold,
  useFonts,
} from "@expo-google-fonts/jetbrains-mono";
import { useEffect, useState } from "react";
import { loadPersistedLanguage } from "@/i18n/config";

// Gates the splash screen: the app is "ready" once the JetBrains Mono weights are
// loaded and the persisted language has been hydrated. The root layout hides the
// native splash on the returned flag.
export function useAppReady(): boolean {
  const [fontsLoaded] = useFonts({
    JetBrainsMono_400Regular,
    JetBrainsMono_500Medium,
    JetBrainsMono_700Bold,
  });
  const [languageLoaded, setLanguageLoaded] = useState(false);

  useEffect(() => {
    void loadPersistedLanguage().finally(() => setLanguageLoaded(true));
  }, []);

  return fontsLoaded && languageLoaded;
}
