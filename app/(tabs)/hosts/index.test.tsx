import "@/i18n/config";
import { renderWithProviders } from "@/test/renderWithProviders";
import HostsScreen from "./index";

describe("HostsScreen", () => {
  it("renders the title, search shell, section header and a host row", async () => {
    const { getByText } = await renderWithProviders(<HostsScreen />);

    expect(getByText("Hosts")).toBeOnTheScreen();
    expect(getByText("Search hosts")).toBeOnTheScreen();
    expect(getByText("PERSONAL")).toBeOnTheScreen();
    expect(getByText("homelab")).toBeOnTheScreen();
    expect(getByText("deniz@homelab.local:22")).toBeOnTheScreen();
  });
});
