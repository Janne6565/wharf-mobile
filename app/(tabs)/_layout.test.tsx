import { render } from "@testing-library/react-native";
import type { ReactNode } from "react";
import "@/i18n/config";

// Mock expo-router's Tabs so the layout renders under Node: Tabs is a passthrough
// and each Tabs.Screen renders its resolved title, letting us assert the tab set.
jest.mock("expo-router", () => {
  const { Text } = require("react-native");
  const Tabs = ({ children }: { children: ReactNode }) => children;
  Tabs.Screen = ({ options }: { options?: { title?: string } }) => <Text>{options?.title}</Text>;
  return { Tabs };
});

import TabsLayout from "./_layout";

describe("TabsLayout", () => {
  it("registers the four tabs with translated titles", async () => {
    const { getByText } = await render(<TabsLayout />);

    for (const label of ["Hosts", "Projects", "Keys", "Settings"]) {
      expect(getByText(label)).toBeOnTheScreen();
    }
  });
});
