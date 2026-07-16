import { QueryClientProvider } from "@tanstack/react-query";
import { render } from "@testing-library/react-native";
import type { ReactElement, ReactNode } from "react";
import { SafeAreaProvider } from "react-native-safe-area-context";
import { Provider } from "react-redux";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";

const METRICS = {
  frame: { x: 0, y: 0, width: 390, height: 844 },
  insets: { top: 47, left: 0, right: 0, bottom: 34 },
};

function Wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>
        <SafeAreaProvider initialMetrics={METRICS}>{children}</SafeAreaProvider>
      </QueryClientProvider>
    </Provider>
  );
}

// Renders a component tree with the app's Redux, React Query, and safe-area
// providers wired — the test-side mirror of app/_layout.tsx. RTL's render is
// async (test-renderer 1.x), so callers must await this.
export function renderWithProviders(ui: ReactElement) {
  return render(ui, { wrapper: Wrapper });
}
