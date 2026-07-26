import "@/i18n/config";
import { act, fireEvent, waitFor } from "@testing-library/react-native";
import { Alert } from "react-native";
import { store } from "@/store";
import {
  identityKeyMismatchSet,
  projectsLoaded,
  projectsReset,
  projectsSyncStarted,
} from "@/store/projectsSlice";
import type { InviteView, ProjectView } from "@/sync/projectTypes";
import { renderWithProviders } from "@/test/renderWithProviders";
import ProjectsScreen from "../../../app/(tabs)/projects/index";

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
const mockCreateProject = jest.fn();
jest.mock("@/api/wharf", () => ({
  acceptInvite: (id: string) => mockAccept(id),
  declineInvite: (id: string) => mockDecline(id),
  createProject: (body: unknown) => mockCreateProject(body),
}));
jest.mock("@/sync/projectsEngine", () => ({
  runProjectsSync: jest.fn().mockResolvedValue(undefined),
}));

// The create flow bootstraps the account identity and seals the project blob; both
// are covered in isolation (identity.test / projectCreate.test), so mock them here
// and assert the screen wires them into the create API call.
const mockEnsureIdentity = jest.fn();
const mockRepublish = jest.fn();
jest.mock("@/vault/identity", () => ({
  ensureIdentity: () => mockEnsureIdentity(),
  republishLocalPublicKey: () => mockRepublish(),
}));
const mockBuildCreateProject = jest.fn();
jest.mock("@/vault/projectCreate", () => ({
  buildCreateProject: (pub: Uint8Array) => mockBuildCreateProject(pub),
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
    mockCreateProject.mockResolvedValue({ id: "p-new" });
    mockEnsureIdentity.mockResolvedValue({
      kind: "ready",
      keys: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) },
    });
    mockBuildCreateProject.mockResolvedValue({ vault: "vault-b64", wrappedDek: "dek-b64" });
    mockRepublish.mockResolvedValue(undefined);
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

  it("shows the first-load skeleton (not the empty state) while the first pass runs", async () => {
    // A first pass is in flight and nothing has loaded yet.
    store.dispatch(projectsSyncStarted());
    const { getByTestId, queryByText } = await renderWithProviders(<ProjectsScreen />);

    expect(getByTestId("projects-skeleton")).toBeOnTheScreen();
    expect(queryByText("No projects yet")).toBeNull();
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

  it("opens the create sheet from the add button", async () => {
    store.dispatch(projectsLoaded({ projects: [], invites: [], offline: false }));
    const utils = await renderWithProviders(<ProjectsScreen />);

    fireEvent.press(utils.getByTestId("projects-add"));
    await waitFor(() => expect(utils.getByTestId("project-name")).toBeOnTheScreen());
  });

  it("creates a project from the sheet and closes it on success", async () => {
    store.dispatch(projectsLoaded({ projects: [], invites: [], offline: false }));
    const utils = await renderWithProviders(<ProjectsScreen />);
    fireEvent.press(utils.getByTestId("projects-add"));
    await waitFor(() => expect(utils.getByTestId("project-name")).toBeOnTheScreen());

    await act(async () => {
      fireEvent.changeText(utils.getByTestId("project-name"), "Nebula");
    });
    await act(async () => {
      fireEvent.press(utils.getByTestId("project-submit"));
    });

    await waitFor(() =>
      expect(mockCreateProject).toHaveBeenCalledWith(
        expect.objectContaining({ name: "Nebula", vault: "vault-b64", wrappedDek: "dek-b64" }),
      ),
    );
    // Success closes the sheet, so its fields unmount.
    await waitFor(() => expect(utils.queryByTestId("project-name")).toBeNull());
  });

  it("warns about a public-key mismatch, showing both labelled fingerprints", async () => {
    store.dispatch(
      identityKeyMismatchSet({
        localFingerprint: "Zmh6 rfhi vXds j8GL",
        serverFingerprint: "cs1u hCLE B/tt CYaQ",
      }),
    );
    const { getByText, getByTestId } = await renderWithProviders(<ProjectsScreen />);

    expect(getByTestId("key-mismatch-warning")).toBeOnTheScreen();
    expect(getByText("Public key mismatch")).toBeOnTheScreen();
    expect(getByText("Fingerprint in this vault")).toBeOnTheScreen();
    expect(getByText("Zmh6 rfhi vXds j8GL")).toBeOnTheScreen();
    expect(getByText("Fingerprint published by the server")).toBeOnTheScreen();
    expect(getByText("cs1u hCLE B/tt CYaQ")).toBeOnTheScreen();
  });

  it("does not republish when the confirmation is dismissed", async () => {
    store.dispatch(identityKeyMismatchSet({ localFingerprint: "aaaa", serverFingerprint: "bbbb" }));
    // An Alert the user walks away from: no button is pressed.
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation(() => {});
    const { getByTestId } = await renderWithProviders(<ProjectsScreen />);

    fireEvent.press(getByTestId("key-mismatch-republish"));

    expect(alertSpy).toHaveBeenCalled();
    expect(mockRepublish).not.toHaveBeenCalled();
    alertSpy.mockRestore();
  });

  it("republishes this vault's key once the destructive confirmation is accepted", async () => {
    store.dispatch(identityKeyMismatchSet({ localFingerprint: "aaaa", serverFingerprint: "bbbb" }));
    const alertSpy = jest.spyOn(Alert, "alert").mockImplementation((_t, _b, buttons) => {
      buttons?.find((btn) => btn.style === "destructive")?.onPress?.();
    });
    const { getByTestId } = await renderWithProviders(<ProjectsScreen />);

    fireEvent.press(getByTestId("key-mismatch-republish"));

    // republishLocalPublicKey is what sends the local key with rotate:true (see
    // identity.test.ts); the screen's job is to only call it behind the confirm.
    await waitFor(() => expect(mockRepublish).toHaveBeenCalledTimes(1));
    alertSpy.mockRestore();
  });

  it("keeps the create submit disabled until a name is entered", async () => {
    store.dispatch(projectsLoaded({ projects: [], invites: [], offline: false }));
    const utils = await renderWithProviders(<ProjectsScreen />);
    fireEvent.press(utils.getByTestId("projects-add"));
    await waitFor(() => expect(utils.getByTestId("project-submit")).toBeOnTheScreen());

    fireEvent.press(utils.getByTestId("project-submit"));
    expect(mockCreateProject).not.toHaveBeenCalled();
  });
});
