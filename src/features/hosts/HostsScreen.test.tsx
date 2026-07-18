import "@/i18n/config";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { store } from "@/store";
import { probeResulted } from "@/store/probesSlice";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import { renderWithProviders } from "@/test/renderWithProviders";
import HostsScreen from "../../../app/(tabs)/hosts/index";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  // The host list runs a reachability sweep on focus; a no-op keeps these list
  // tests focused on grouping/search (probing is covered in useHostProbes.test).
  useFocusEffect: () => {},
}));

const HOSTS = [
  { id: "h1", name: "homelab", user: "deniz", addr: "homelab.local", port: 22 },
  { id: "h2", name: "prod-api-01", user: "deploy", addr: "10.4.1.12", port: 22 },
];

describe("HostsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(vaultLocked());
  });

  it("renders the decrypted hosts grouped under PERSONAL", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    const { getByText } = await renderWithProviders(<HostsScreen />);

    // v2 ScreenTitle prefixes the mono title with an accent `❯` prompt.
    expect(getByText("❯ Hosts")).toBeOnTheScreen();
    expect(getByText("PERSONAL")).toBeOnTheScreen();
    expect(getByText("homelab")).toBeOnTheScreen();
    expect(getByText("deniz@homelab.local:22")).toBeOnTheScreen();
    expect(getByText("prod-api-01")).toBeOnTheScreen();
  });

  it("filters hosts with the search field", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    const { getByText, queryByText, getByPlaceholderText } = await renderWithProviders(
      <HostsScreen />,
    );

    fireEvent.changeText(getByPlaceholderText("Search hosts"), "prod");
    await waitFor(() => expect(queryByText("homelab")).toBeNull());
    expect(getByText("prod-api-01")).toBeOnTheScreen();

    fireEvent.changeText(getByPlaceholderText("Search hosts"), "zzz");
    await waitFor(() => expect(getByText("No hosts match your search.")).toBeOnTheScreen());
  });

  it("navigates to the host detail on row press", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    const { getByText } = await renderWithProviders(<HostsScreen />);

    fireEvent.press(getByText("homelab"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/hosts/[hostId]",
      params: { hostId: "h1" },
    });
  });

  it("renders the probe RTT inline for a reachable host", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    store.dispatch(probeResulted({ hostId: "h1", status: "online", rttMs: 12 }));
    const { getByText } = await renderWithProviders(<HostsScreen />);

    expect(getByText("12ms")).toBeOnTheScreen();
  });

  it("shows the empty state when the vault has no hosts", async () => {
    store.dispatch(vaultUnlocked({ hosts: [], version: 1 }));
    const { getByText } = await renderWithProviders(<HostsScreen />);

    expect(getByText("No hosts yet.")).toBeOnTheScreen();
  });
});
