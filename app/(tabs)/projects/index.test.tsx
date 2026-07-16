import "@/i18n/config";
import { fireEvent, waitFor } from "@testing-library/react-native";
import { store } from "@/store";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import type { InviteView, ProjectView } from "@/sync/projectTypes";
import { renderWithProviders } from "@/test/renderWithProviders";
import ProjectsScreen from "./index";

const mockPush = jest.fn();
jest.mock("expo-router", () => {
  const react = require("react");
  return {
    useRouter: () => ({ push: mockPush, back: jest.fn() }),
    useFocusEffect: (cb: () => void) => react.useEffect(cb, [cb]),
  };
});

const mockAccept = jest.fn().mockResolvedValue({});
const mockDecline = jest.fn().mockResolvedValue({});
jest.mock("@/api/wharf", () => ({
  acceptInvite: (id: string) => mockAccept(id),
  declineInvite: (id: string) => mockDecline(id),
}));
jest.mock("@/sync/projectsEngine", () => ({
  runProjectsSync: jest.fn().mockResolvedValue(undefined),
}));

const PROJECT: ProjectView = {
  id: "p1",
  name: "Atlas Platform",
  description: "Core API + data plane",
  role: "ADMIN",
  memberCount: 3,
  pendingInviteCount: 0,
  version: 5,
  awaiting: false,
  hosts: [
    { id: "h1", name: "prod-api-01", user: "deploy", addr: "10.4.1.12", port: 22 },
    { id: "h2", name: "prod-api-02", user: "deploy", addr: "10.4.1.13", port: 22 },
  ],
};

const INVITE: InviteView = {
  id: "i1",
  projectId: "p9",
  projectName: "Nebula",
  invitedByEmail: "mara@acme.io",
};

describe("ProjectsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(projectsReset());
  });

  it("renders a project row with role and host/member counts", async () => {
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectsScreen />);

    expect(getByText("Atlas Platform")).toBeOnTheScreen();
    expect(getByText("admin")).toBeOnTheScreen();
    expect(getByText("2 hosts · 3 members")).toBeOnTheScreen();
  });

  it("opens the project detail on row press", async () => {
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectsScreen />);

    fireEvent.press(getByText("Atlas Platform"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/projects/[projectId]",
      params: { projectId: "p1" },
    });
  });

  it("shows the empty state when signed in with no projects or invites", async () => {
    store.dispatch(projectsLoaded({ projects: [], invites: [], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectsScreen />);
    expect(getByText("No projects yet")).toBeOnTheScreen();
  });

  it("renders a pending invite and accepts it", async () => {
    store.dispatch(projectsLoaded({ projects: [], invites: [INVITE], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectsScreen />);

    expect(getByText("Nebula")).toBeOnTheScreen();
    expect(getByText("Invited by mara@acme.io")).toBeOnTheScreen();

    fireEvent.press(getByText("Accept"));
    await waitFor(() => expect(mockAccept).toHaveBeenCalledWith("i1"));
  });

  it("declines a pending invite", async () => {
    store.dispatch(projectsLoaded({ projects: [], invites: [INVITE], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectsScreen />);

    fireEvent.press(getByText("Decline"));
    await waitFor(() => expect(mockDecline).toHaveBeenCalledWith("i1"));
  });
});
