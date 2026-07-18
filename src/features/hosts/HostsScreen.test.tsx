import "@/i18n/config";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { store } from "@/store";
import { probeResulted } from "@/store/probesSlice";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import type { ProjectView } from "@/sync/projectTypes";
import { renderWithProviders } from "@/test/renderWithProviders";
import HostsScreen from "../../../app/(tabs)/hosts/index";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  // The host list runs a reachability sweep on focus; a no-op keeps these list
  // tests focused on grouping/search (probing is covered in useHostProbes.test).
  useFocusEffect: () => {},
}));

// The context menu's move + delete actions call these; the move/delete paths are
// covered in isolation (projectVaultWrite.test / hostMutations), so mock them here
// and assert the screen wires the right host/project into each call.
const mockMove = jest.fn().mockResolvedValue(undefined);
jest.mock("@/sync/projectVaultWrite", () => ({
  moveHostToProject: (hostId: string, projectId: string) => mockMove(hostId, projectId),
  ProjectWriteError: class ProjectWriteError extends Error {
    code: string;
    constructor(code: string) {
      super(code);
      this.code = code;
    }
  },
}));
const mockDeleteHost = jest.fn().mockResolvedValue(undefined);
jest.mock("@/vault/hostMutations", () => ({
  deleteHost: (id: string) => mockDeleteHost(id),
}));

// The Hosts tab kicks the projects pass on focus (project host sections). The
// engine is covered in isolation, so stub it here.
jest.mock("@/sync/projectsEngine", () => ({
  runProjectsSync: jest.fn().mockResolvedValue(undefined),
}));

const HOSTS = [
  { id: "h1", name: "homelab", user: "deniz", addr: "homelab.local", port: 22 },
  { id: "h2", name: "prod-api-01", user: "deploy", addr: "10.4.1.12", port: 22 },
];

const PROJECT: ProjectView = {
  id: "pj1",
  name: "Atlas Platform",
  description: "",
  role: "ADMIN",
  memberCount: 2,
  pendingInviteCount: 0,
  version: 5,
  awaiting: false,
  hosts: [{ id: "ph1", name: "shared-db", user: "deploy", addr: "db.atlas.io", port: 22 }],
};

const AWAITING_PROJECT: ProjectView = {
  ...PROJECT,
  id: "pj2",
  name: "Locked Project",
  awaiting: true,
  hosts: [],
};

describe("HostsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(vaultLocked());
    store.dispatch(projectsReset());
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

  it("opens the context menu with all four actions on long-press of a personal host", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    const { getByText, getByTestId } = await renderWithProviders(<HostsScreen />);

    fireEvent(getByText("homelab"), "longPress");

    await waitFor(() => expect(getByTestId("host-action-connect")).toBeOnTheScreen());
    expect(getByTestId("host-action-edit")).toBeOnTheScreen();
    expect(getByTestId("host-action-move")).toBeOnTheScreen();
    expect(getByTestId("host-action-delete")).toBeOnTheScreen();
  });

  it("connects to the terminal route from the menu", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    const { getByText, getByTestId } = await renderWithProviders(<HostsScreen />);

    fireEvent(getByText("homelab"), "longPress");
    await waitFor(() => expect(getByTestId("host-action-connect")).toBeOnTheScreen());
    fireEvent.press(getByTestId("host-action-connect"));

    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/hosts/terminal",
      params: { hostId: "h1" },
    });
  });

  it("shows only Connect for a project host", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    const { getByText, getByTestId, queryByTestId } = await renderWithProviders(<HostsScreen />);

    fireEvent(getByText("shared-db"), "longPress");

    await waitFor(() => expect(getByTestId("host-action-connect")).toBeOnTheScreen());
    expect(queryByTestId("host-action-edit")).toBeNull();
    expect(queryByTestId("host-action-move")).toBeNull();
    expect(queryByTestId("host-action-delete")).toBeNull();
  });

  it("moves a personal host into a chosen non-awaiting project", async () => {
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    store.dispatch(
      projectsLoaded({ projects: [PROJECT, AWAITING_PROJECT], invites: [], offline: false }),
    );
    const { getByText, getByTestId, queryByTestId } = await renderWithProviders(<HostsScreen />);

    fireEvent(getByText("homelab"), "longPress");
    await waitFor(() => expect(getByTestId("host-action-move")).toBeOnTheScreen());
    fireEvent.press(getByTestId("host-action-move"));

    // The awaiting project is not writable, so it never appears in the picker.
    await waitFor(() => expect(getByTestId("host-move-project-pj1")).toBeOnTheScreen());
    expect(queryByTestId("host-move-project-pj2")).toBeNull();

    fireEvent.press(getByTestId("host-move-project-pj1"));
    await waitFor(() => expect(mockMove).toHaveBeenCalledWith("h1", "pj1"));
  });

  it("deletes a personal host after the confirm alert", async () => {
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => undefined);
    store.dispatch(vaultUnlocked({ hosts: HOSTS, version: 1 }));
    const { getByText, getByTestId } = await renderWithProviders(<HostsScreen />);

    fireEvent(getByText("homelab"), "longPress");
    await waitFor(() => expect(getByTestId("host-action-delete")).toBeOnTheScreen());
    fireEvent.press(getByTestId("host-action-delete"));

    // Invoke the destructive button the confirm alert was configured with.
    const buttons = alertSpy.mock.calls[0][2] ?? [];
    const confirm = buttons.find((b) => b.style === "destructive");
    confirm?.onPress?.();

    await waitFor(() => expect(mockDeleteHost).toHaveBeenCalledWith("h1"));
    alertSpy.mockRestore();
  });
});
