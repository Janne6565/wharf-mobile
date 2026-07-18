import "@/i18n/config";
import { fireEvent } from "@testing-library/react-native";
import { store } from "@/store";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import type { ProjectView } from "@/sync/projectTypes";
import { renderWithProviders } from "@/test/renderWithProviders";
import HostDetailScreen from "../../../app/(tabs)/hosts/[hostId]";

const mockBack = jest.fn();
const mockPush = jest.fn();
let mockParams: Record<string, string> = {};
// The route segments drive the back-label + terminal-route origin: a projects-stack
// render is (tabs)/projects/host/[hostId]; the Hosts-tab copy is (tabs)/hosts/[hostId].
let mockSegments: string[] = ["(tabs)", "hosts", "[hostId]"];
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: mockBack }),
  useLocalSearchParams: () => mockParams,
  useSegments: () => mockSegments,
  // The detail screen probes the host on focus; a no-op keeps these tests focused
  // on the back/terminal navigation (probing is covered in useHostProbes.test).
  useFocusEffect: () => {},
}));

jest.mock("@/vault/hostMutations", () => ({
  deleteHost: jest.fn().mockResolvedValue(undefined),
}));

const PROJECTS_SEGMENTS = ["(tabs)", "projects", "host", "[hostId]"];
const HOSTS_SEGMENTS = ["(tabs)", "hosts", "[hostId]"];

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
    mockSegments = HOSTS_SEGMENTS;
    store.dispatch(vaultLocked());
    store.dispatch(projectsReset());
  });

  it("labels back with the project name and pops the stack when rendered in the projects stack", async () => {
    store.dispatch(vaultUnlocked({ hosts: PERSONAL, keys: [], version: 1 }));
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    mockSegments = PROJECTS_SEGMENTS;
    mockParams = { hostId: "ph1", projectId: "pj1" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    // The back link carries the project name, not the generic "Hosts" label.
    fireEvent.press(getByText("Atlas Platform"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("falls back to the generic project label when the project name is unavailable", async () => {
    mockSegments = PROJECTS_SEGMENTS;
    mockParams = { hostId: "ph1", projectId: "pj1" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByText("Project"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("labels back Hosts and pops the stack when a project host is opened from the Hosts tab", async () => {
    store.dispatch(vaultUnlocked({ hosts: PERSONAL, keys: [], version: 1 }));
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    // Hosts-tab origin: projectId is present (project host) but the render is under
    // the hosts stack, so the back label is generic and back() pops that stack.
    mockSegments = HOSTS_SEGMENTS;
    mockParams = { hostId: "ph1", projectId: "pj1" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByText("Hosts"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("labels back Hosts and pops the stack for a personal host", async () => {
    store.dispatch(vaultUnlocked({ hosts: PERSONAL, keys: [], version: 1 }));
    mockSegments = HOSTS_SEGMENTS;
    mockParams = { hostId: "h1" };
    const { getByText } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByText("Hosts"));
    expect(mockBack).toHaveBeenCalled();
  });

  it("connects into the projects-stack terminal from the projects stack", async () => {
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    mockSegments = PROJECTS_SEGMENTS;
    mockParams = { hostId: "ph1", projectId: "pj1" };
    const { getByTestId } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByTestId("host-detail-connect"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/projects/terminal",
      params: { hostId: "ph1", projectId: "pj1" },
    });
  });

  it("connects into the hosts-stack terminal from the hosts stack", async () => {
    store.dispatch(vaultUnlocked({ hosts: PERSONAL, keys: [], version: 1 }));
    mockSegments = HOSTS_SEGMENTS;
    mockParams = { hostId: "h1" };
    const { getByTestId } = await renderWithProviders(<HostDetailScreen />);

    fireEvent.press(getByTestId("host-detail-connect"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/hosts/terminal",
      params: { hostId: "h1" },
    });
  });
});
