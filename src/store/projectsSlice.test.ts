import type { InviteView, ProjectView } from "@/sync/projectTypes";
import reducer, {
  identityNeedsSyncSet,
  projectsLoaded,
  projectsReset,
  projectsSyncSettled,
  projectsSyncStarted,
} from "./projectsSlice";

const view = (over: Partial<ProjectView> = {}): ProjectView => ({
  id: "p1",
  name: "Atlas Platform",
  description: "Core",
  role: "MEMBER",
  memberCount: 3,
  pendingInviteCount: 0,
  version: 5,
  awaiting: false,
  hosts: [
    { id: "h1", name: "prod-web-01", user: "deploy", addr: "10.0.4.12", port: 22, tags: ["prod"] },
  ],
  ...over,
});

const invite: InviteView = {
  id: "i1",
  projectId: "p9",
  projectName: "Nebula",
  invitedByEmail: "mara@acme.io",
};

describe("projectsSlice", () => {
  it("marks the phase syncing while a pass runs", () => {
    const state = reducer(undefined, projectsSyncStarted());
    expect(state.phase).toBe("syncing");
  });

  it("loads projects + invites, clearing the needs-sync flag", () => {
    const state = reducer(
      undefined,
      projectsLoaded({ projects: [view()], invites: [invite], offline: false }),
    );
    expect(state.loaded).toBe(true);
    expect(state.phase).toBe("idle");
    expect(state.offline).toBe(false);
    expect(state.identityNeedsSync).toBe(false);
    expect(state.projects).toHaveLength(1);
    expect(state.invites).toEqual([invite]);
    // Host tags are copied into a mutable array (Immer-safe) but stay equal.
    expect(state.projects[0].hosts[0].tags).toEqual(["prod"]);
  });

  it("settles the phase on an empty offline pass without clobbering shown data", () => {
    const loaded = reducer(
      undefined,
      projectsLoaded({ projects: [view()], invites: [], offline: false }),
    );
    const settled = reducer(loaded, projectsSyncSettled({ offline: true }));
    expect(settled.offline).toBe(true);
    expect(settled.projects).toHaveLength(1);
  });

  it("raises the needs-sync notice", () => {
    const state = reducer(undefined, identityNeedsSyncSet());
    expect(state.identityNeedsSync).toBe(true);
    expect(state.loaded).toBe(true);
  });

  it("resets to the initial state on lock", () => {
    const loaded = reducer(
      undefined,
      projectsLoaded({ projects: [view()], invites: [invite], offline: true }),
    );
    const reset = reducer(loaded, projectsReset());
    expect(reset.projects).toEqual([]);
    expect(reset.invites).toEqual([]);
    expect(reset.loaded).toBe(false);
    expect(reset.identityNeedsSync).toBe(false);
  });
});
