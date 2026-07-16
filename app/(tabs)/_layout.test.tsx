import type { ReactNode } from "react";
import "@/i18n/config";
import { renderWithProviders } from "@/test/renderWithProviders";

// Mock expo-router's Tabs so the layout renders under Node: Tabs is a passthrough
// and each Tabs.Screen renders its resolved title, letting us assert the tab set.
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  const Tabs = ({ children }: { children: ReactNode }) => children;
  Tabs.Screen = ({ options }: { options?: { title?: string } }) => <Text>{options?.title}</Text>;
  return { Tabs };
});

// The sync engine lifecycle touches native modules (expo-network, AppState) that
// are out of scope for this layout test — stub it to a no-op.
jest.mock("@/hooks/useSyncEngine", () => ({ useSyncEngine: () => {} }));

import TabsLayout from "./_layout";

describe("TabsLayout", () => {
  it("registers the four tabs with translated titles", async () => {
    const { getByText } = await renderWithProviders(<TabsLayout />);

    for (const label of ["Hosts", "Projects", "Keys", "Settings"]) {
      expect(getByText(label)).toBeOnTheScreen();
    }
  });
});
