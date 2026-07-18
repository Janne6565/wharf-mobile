import "@/i18n/config";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import type { Project } from "@/api/generated/model";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";
import { sessionEstablished } from "@/store/authSlice";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import type { ProjectView } from "@/sync/projectTypes";
import { renderWithProviders } from "@/test/renderWithProviders";
import ProjectDetailScreen from "../../../app/(tabs)/projects/[projectId]";

const mockPush = jest.fn();
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: mockPush, back: jest.fn() }),
  useLocalSearchParams: () => ({ projectId: "p1" }),
  // The detail screen probes its hosts on focus; a no-op keeps these tests focused
  // on members/invites (probing is covered in useHostProbes.test).
  useFocusEffect: () => {},
}));

const mockGetProject = jest.fn();
const mockCreateInvite = jest.fn();
const mockRevokeInvite = jest.fn();
const mockUpdateProject = jest.fn();
const mockDeleteProject = jest.fn();
const mockLeaveProject = jest.fn();
jest.mock("@/api/wharf", () => ({
  getProject: () => mockGetProject(),
  createInvite: (id: string, body: { email: string }) => mockCreateInvite(id, body),
  revokeInvite: (id: string, inviteId: string) => mockRevokeInvite(id, inviteId),
  updateProject: (id: string, body: unknown) => mockUpdateProject(id, body),
  deleteProject: (id: string) => mockDeleteProject(id),
  leaveProject: (id: string) => mockLeaveProject(id),
}));

const mockRunProjectsSync = jest.fn();
jest.mock("@/sync/projectsEngine", () => ({
  runProjectsSync: () => mockRunProjectsSync(),
}));

function view(over: Partial<ProjectView> = {}): ProjectView {
  return {
    id: "p1",
    name: "Atlas Platform",
    description: "Core API + data plane",
    role: "ADMIN",
    memberCount: 3,
    pendingInviteCount: 1,
    version: 5,
    awaiting: false,
    hosts: [{ id: "h1", name: "prod-api-01", user: "deploy", addr: "10.4.1.12", port: 22 }],
    ...over,
  };
}

const DETAIL: Project = {
  id: "p1",
  name: "Atlas Platform",
  role: "ADMIN",
  members: [
    { userId: "u-mara", email: "mara@acme.io", role: "OWNER", keyed: true },
    { userId: "u-me", email: "deniz@acme.io", role: "ADMIN", keyed: true },
  ],
  invites: [{ id: "inv1", email: "sam@acme.io", createdAt: "", expiresAt: "" }],
};

// An axios-shaped error that getHttpStatus recognises.
function httpError(status: number): unknown {
  return { isAxiosError: true, response: { status } };
}

type Utils = Awaited<ReturnType<typeof renderWithProviders>>;

async function openInviteSheet(): Promise<Utils> {
  store.dispatch(projectsLoaded({ projects: [view()], invites: [], offline: false }));
  const utils = await renderWithProviders(<ProjectDetailScreen />);
  await waitFor(() => expect(utils.getByText("mara@acme.io")).toBeOnTheScreen());
  fireEvent.press(utils.getByTestId("invite-member-row"));
  // Concurrent render: the sheet's contents appear on the next flush.
  await waitFor(() => expect(utils.getByTestId("invite-email")).toBeOnTheScreen());
  return utils;
}

// Fill the email and submit, each wrapped in act so the controlled-input and
// handleSubmit state updates flush before the next step (the submit button is
// gated on a non-empty email, so the value must land before the press).
async function fillAndSubmit(utils: Utils, email: string) {
  await act(async () => {
    fireEvent.changeText(utils.getByTestId("invite-email"), email);
  });
  await act(async () => {
    fireEvent.press(utils.getByTestId("invite-submit"));
  });
}

describe("ProjectDetailScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    // The app's singleton QueryClient is shared across tests; clear it so a stale
    // project detail (role) from a prior test doesn't leak into the next.
    queryClient.clear();
    store.dispatch(projectsReset());
    store.dispatch(sessionEstablished({ id: "u-me", email: "deniz@acme.io" }));
    mockGetProject.mockResolvedValue(DETAIL);
    mockCreateInvite.mockResolvedValue({ id: "inv2", email: "new@acme.io" });
    mockRevokeInvite.mockResolvedValue(undefined);
    mockUpdateProject.mockResolvedValue(undefined);
    mockDeleteProject.mockResolvedValue(undefined);
    mockLeaveProject.mockResolvedValue(undefined);
  });

  it("renders the title, summary, members with (you), pending invite and hosts", async () => {
    store.dispatch(projectsLoaded({ projects: [view()], invites: [], offline: false }));
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
    store.dispatch(projectsLoaded({ projects: [view()], invites: [], offline: false }));
    const { getByText } = await renderWithProviders(<ProjectDetailScreen />);

    fireEvent.press(getByText("prod-api-01"));
    expect(mockPush).toHaveBeenCalledWith({
      pathname: "/(tabs)/projects/host/[hostId]",
      params: { hostId: "h1", projectId: "p1" },
    });
  });

  it("submits an invite, re-fires the finalize sync, and shows the canonical copy", async () => {
    const utils = await openInviteSheet();
    expect(
      utils.getByText("They get access to this project's hosts. Keys stay yours."),
    ).toBeOnTheScreen();

    await fillAndSubmit(utils, "new@acme.io");

    await waitFor(() =>
      expect(mockCreateInvite).toHaveBeenCalledWith("p1", { email: "new@acme.io" }),
    );
    // Success re-fires the projects sync so the finalize pass runs again.
    await waitFor(() => expect(mockRunProjectsSync).toHaveBeenCalled());
  });

  it("maps a 409 to the already-member/invited message", async () => {
    mockCreateInvite.mockRejectedValueOnce(httpError(409));
    const utils = await openInviteSheet();

    await fillAndSubmit(utils, "sam@acme.io");

    await waitFor(() =>
      expect(
        utils.getByText("That person is already a member or already invited."),
      ).toBeOnTheScreen(),
    );
    expect(mockRunProjectsSync).not.toHaveBeenCalled();
  });

  it("maps a 429 to the rate-limited message", async () => {
    mockCreateInvite.mockRejectedValueOnce(httpError(429));
    const utils = await openInviteSheet();

    await fillAndSubmit(utils, "new@acme.io");

    await waitFor(() =>
      expect(
        utils.getByText("Too many invites just now. Try again in a moment."),
      ).toBeOnTheScreen(),
    );
  });

  it("rejects a malformed email on submit without calling the API", async () => {
    const utils = await openInviteSheet();

    await fillAndSubmit(utils, "not-an-email");

    await waitFor(() => expect(utils.getByText("Enter a valid email address.")).toBeOnTheScreen());
    expect(mockCreateInvite).not.toHaveBeenCalled();
  });

  it("hides the invite action and revoke control from a plain member", async () => {
    store.dispatch(
      projectsLoaded({ projects: [view({ role: "MEMBER" })], invites: [], offline: false }),
    );
    mockGetProject.mockResolvedValue({ ...DETAIL, role: "MEMBER" });
    const { queryByTestId, getByText } = await renderWithProviders(<ProjectDetailScreen />);

    await waitFor(() => expect(getByText("sam@acme.io")).toBeOnTheScreen());
    expect(queryByTestId("invite-member-row")).toBeNull();
    expect(queryByTestId("invite-revoke")).toBeNull();
  });

  it("revokes a pending invite after confirmation", async () => {
    // Auto-confirm the destructive Alert by invoking its confirm button.
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_t, _b, buttons) => {
      buttons?.find((btn) => btn.style === "destructive")?.onPress?.();
    });
    store.dispatch(projectsLoaded({ projects: [view()], invites: [], offline: false }));
    const { getByTestId, getByText } = await renderWithProviders(<ProjectDetailScreen />);
    await waitFor(() => expect(getByText("sam@acme.io")).toBeOnTheScreen());

    fireEvent.press(getByTestId("invite-revoke"));

    await waitFor(() => expect(mockRevokeInvite).toHaveBeenCalledWith("p1", "inv1"));
    alertSpy.mockRestore();
  });

  // Auto-confirm a destructive Alert by invoking its confirm button.
  function autoConfirmAlert() {
    return jest.spyOn(Alert, "alert").mockImplementation((_t, _b, buttons) => {
      buttons?.find((btn) => btn.style === "destructive")?.onPress?.();
    });
  }

  it("shows the edit and leave actions to an admin, but not delete", async () => {
    store.dispatch(projectsLoaded({ projects: [view()], invites: [], offline: false }));
    const { getByTestId, queryByTestId, getByText } = await renderWithProviders(
      <ProjectDetailScreen />,
    );

    await waitFor(() => expect(getByText("mara@acme.io")).toBeOnTheScreen());
    expect(getByTestId("project-edit-row")).toBeOnTheScreen();
    expect(getByTestId("project-leave-row")).toBeOnTheScreen();
    expect(queryByTestId("project-delete-row")).toBeNull();
  });

  it("shows the delete action (not leave) to the owner", async () => {
    store.dispatch(
      projectsLoaded({ projects: [view({ role: "OWNER" })], invites: [], offline: false }),
    );
    mockGetProject.mockResolvedValue({ ...DETAIL, role: "OWNER" });
    const { getByTestId, queryByTestId, getByText } = await renderWithProviders(
      <ProjectDetailScreen />,
    );

    await waitFor(() => expect(getByText("mara@acme.io")).toBeOnTheScreen());
    expect(getByTestId("project-edit-row")).toBeOnTheScreen();
    expect(getByTestId("project-delete-row")).toBeOnTheScreen();
    expect(queryByTestId("project-leave-row")).toBeNull();
  });

  it("shows only the leave action to a plain member", async () => {
    store.dispatch(
      projectsLoaded({ projects: [view({ role: "MEMBER" })], invites: [], offline: false }),
    );
    mockGetProject.mockResolvedValue({ ...DETAIL, role: "MEMBER" });
    const { getByTestId, queryByTestId, getByText } = await renderWithProviders(
      <ProjectDetailScreen />,
    );

    await waitFor(() => expect(getByText("mara@acme.io")).toBeOnTheScreen());
    expect(getByTestId("project-leave-row")).toBeOnTheScreen();
    expect(queryByTestId("project-edit-row")).toBeNull();
    expect(queryByTestId("project-delete-row")).toBeNull();
  });

  it("saves an edit and re-fires the projects sync", async () => {
    store.dispatch(projectsLoaded({ projects: [view()], invites: [], offline: false }));
    const utils = await renderWithProviders(<ProjectDetailScreen />);
    await waitFor(() => expect(utils.getByText("mara@acme.io")).toBeOnTheScreen());

    fireEvent.press(utils.getByTestId("project-edit-row"));
    await waitFor(() => expect(utils.getByTestId("project-name")).toBeOnTheScreen());
    await act(async () => {
      fireEvent.changeText(utils.getByTestId("project-name"), "Atlas v2");
    });
    await act(async () => {
      fireEvent.press(utils.getByTestId("project-submit"));
    });

    await waitFor(() =>
      expect(mockUpdateProject).toHaveBeenCalledWith(
        "p1",
        expect.objectContaining({ name: "Atlas v2" }),
      ),
    );
    await waitFor(() => expect(mockRunProjectsSync).toHaveBeenCalled());
  });

  it("deletes the project after confirmation (owner)", async () => {
    const alertSpy = autoConfirmAlert();
    store.dispatch(
      projectsLoaded({ projects: [view({ role: "OWNER" })], invites: [], offline: false }),
    );
    mockGetProject.mockResolvedValue({ ...DETAIL, role: "OWNER" });
    const { getByTestId, getByText } = await renderWithProviders(<ProjectDetailScreen />);
    await waitFor(() => expect(getByText("mara@acme.io")).toBeOnTheScreen());

    fireEvent.press(getByTestId("project-delete-row"));

    await waitFor(() => expect(mockDeleteProject).toHaveBeenCalledWith("p1"));
    alertSpy.mockRestore();
  });

  it("leaves the project after confirmation (member)", async () => {
    const alertSpy = autoConfirmAlert();
    store.dispatch(
      projectsLoaded({ projects: [view({ role: "MEMBER" })], invites: [], offline: false }),
    );
    mockGetProject.mockResolvedValue({ ...DETAIL, role: "MEMBER" });
    const { getByTestId, getByText } = await renderWithProviders(<ProjectDetailScreen />);
    await waitFor(() => expect(getByText("mara@acme.io")).toBeOnTheScreen());

    fireEvent.press(getByTestId("project-leave-row"));

    await waitFor(() => expect(mockLeaveProject).toHaveBeenCalledWith("p1"));
    alertSpy.mockRestore();
  });
});
