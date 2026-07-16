import "@/i18n/config";
import { fireEvent, waitFor } from "@testing-library/react-native";
import type { Project } from "@/api/generated/model";
import { store } from "@/store";
import { sessionEstablished } from "@/store/authSlice";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import type { ProjectView } from "@/sync/projectTypes";
import { renderWithProviders } from "@/test/renderWithProviders";
import ProjectDetailScreen from "./[projectId]";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ projectId: "p1" }),
}));

const mockGetProject = jest.fn();
jest.mock("@/api/wharf", () => ({ getProject: () => mockGetProject() }));

const PROJECT: ProjectView = {
  id: "p1",
  name: "Atlas Platform",
  description: "Core API + data plane",
  role: "ADMIN",
  memberCount: 3,
  pendingInviteCount: 1,
  version: 5,
  awaiting: false,
  hosts: [{ id: "h1", name: "prod-api-01", user: "deploy", addr: "10.4.1.12", port: 22 }],
};

const DETAIL: Project = {
  id: "p1",
  name: "Atlas Platform",
  members: [
    { userId: "u-mara", email: "mara@acme.io", role: "OWNER", keyed: true },
    { userId: "u-me", email: "deniz@acme.io", role: "ADMIN", keyed: true },
  ],
  invites: [{ id: "inv1", email: "sam@acme.io", createdAt: "", expiresAt: "" }],
};

describe("ProjectDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(projectsReset());
    store.dispatch(sessionEstablished({ id: "u-me", email: "deniz@acme.io" }));
    mockGetProject.mockResolvedValue(DETAIL);
  });

  it("renders the title, summary, members with (you), pending invite and hosts", async () => {
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectDetailScreen />);

    expect(getByText("Atlas Platform")).toBeOnTheScreen();
    expect(getByText("Core API + data plane · 1 hosts")).toBeOnTheScreen();

    await waitFor(() => expect(getByText("mara@acme.io")).toBeOnTheScreen());
    expect(getByText("owner")).toBeOnTheScreen();
    expect(getByText("(you)")).toBeOnTheScreen();
    expect(getByText("sam@acme.io")).toBeOnTheScreen();
    expect(getByText("invited · awaiting accept")).toBeOnTheScreen();
    expect(getByText("prod-api-01")).toBeOnTheScreen();
  });

  it("opens a project host tagged with its project id", async () => {
    store.dispatch(projectsLoaded({ projects: [PROJECT], invites: [], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectDetailScreen />);

    fireEvent.press(getByText("prod-api-01"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/hosts/[hostId]",
      params: { hostId: "h1", projectId: "p1" },
    });
  });
});
