import "@/i18n/config";
import { fireEvent } from "@testing-library/react-native";
import { store } from "@/store";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import type { ProjectView } from "@/sync/projectTypes";
import { renderWithProviders } from "@/test/renderWithProviders";
import HostDetailScreen from "../../../app/(tabs)/hosts/[hostId]";

const mockBack = jest.fn();
const mockNavigate = jest.fn();
let mockParams: Record<string, string> = {};
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn(), back: mockBack, navigate: mockNavigate }),
  useLocalSearchParams: () => mockParams,
  // The detail screen probes the host on focus; a no-op keeps these tests focused
  // on the back navigation (probing is covered in useHostProbes.test).
  useFocusEffect: () => {},
}));

jest.mock("@/vault/hostMutations", () => ({
  deleteHost: jest.fn().mockResolvedValue(undefined),
}));

const PERSONAL = [{ id: "h1", name: "homelab", user: "deniz", addr: "homelab.local", port: 22 }];

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

describe("HostDetailScreen back navigation", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockParams = {};
    store.dispatch(vaultLocked());
    store.dispatch(projectsReset());
  });

  it("labels back with the project name and navigates to the project when opened from a project", async () => {
    store.dispatch(vaultUnlocked({ hosts: PERSONAL, version: 1 }));
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    mockParams = { hostId: "ph1", projectId: "pj1", from: "project" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    // The back link carries the project name, not the generic "Hosts" label.
    fireEvent.press(getByText("Atlas Platform"));
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/projects/[projectId]",
      params: { projectId: "pj1" },
    });
    expect(mockBack).not.toHaveBeenCalled();
  });

  it("falls back to the generic project label when the project name is unavailable", async () => {
    mockParams = { hostId: "ph1", projectId: "pj1", from: "project" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByText("Project"));
    expect(mockNavigate).toHaveBeenCalledWith({
      pathname: "/(tabs)/projects/[projectId]",
      params: { projectId: "pj1" },
    });
  });

  it("labels back Hosts and pops the stack when a project host is opened from the Hosts tab", async () => {
    store.dispatch(vaultUnlocked({ hosts: PERSONAL, version: 1 }));
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    // Hosts-tab origin: projectId is present (project host) but no `from` marker.
    mockParams = { hostId: "ph1", projectId: "pj1" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByText("Hosts"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });

  it("labels back Hosts and pops the stack for a personal host", async () => {
    store.dispatch(vaultUnlocked({ hosts: PERSONAL, version: 1 }));
    mockParams = { hostId: "h1" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByText("Hosts"));
    expect(mockBack).toHaveBeenCalled();
    expect(mockNavigate).not.toHaveBeenCalled();
  });
});
