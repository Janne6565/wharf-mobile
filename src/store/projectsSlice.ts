import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { InviteView, ProjectView } from "@/sync/projectTypes";
import type { VaultHost } from "@/vault/document";

// Derived, non-secret projects state for the UI (M4). Like vaultSlice, the secret
// material (project DEKs, decrypted payloads, the account identity private key)
// lives only in module memory / the unlocked session — never here. This slice
// carries the parsed project views (name, role, decrypted hosts with passwords
// stripped), the caller's pending invites, and the identity-needs-sync notice, so
// the Projects tab and the Hosts tab's project sections read them synchronously.
//
// Reset on lock (projectsReset), mirroring vaultSlice.

export type ProjectsPhase = "idle" | "syncing";

// Immer drafts are deeply mutable; mirror vaultSlice's StoredHost so `tags` (the
// only nested array) is a mutable copy while staying assignable to VaultHost.
type StoredHost = Omit<VaultHost, "tags"> & { tags?: string[] };
export type StoredProject = Omit<ProjectView, "hosts"> & { hosts: StoredHost[] };

interface ProjectsState {
  phase: ProjectsPhase;
  // Whether at least one pass (online or cached) has settled — distinguishes the
  // initial loading state from a genuinely empty projects list.
  loaded: boolean;
  offline: boolean;
  // The vault carries no identity but the server holds a key: this device must
  // sync its personal vault from the device that created the identity first.
  identityNeedsSync: boolean;
  projects: StoredProject[];
  invites: InviteView[];
}

const initialState: ProjectsState = {
  phase: "idle",
  loaded: false,
  offline: false,
  identityNeedsSync: false,
  projects: [],
  invites: [],
};

function toStoredProjects(projects: readonly ProjectView[]): StoredProject[] {
  return projects.map((project) => ({
    ...project,
    hosts: project.hosts.map((host) => ({ ...host, tags: host.tags ? [...host.tags] : undefined })),
  }));
}

interface ProjectsLoaded {
  readonly projects: readonly ProjectView[];
  readonly invites: readonly InviteView[];
  readonly offline: boolean;
}

const projectsSlice = createSlice({
  name: "projects",
  initialState,
  reducers: {
    projectsSyncStarted(state) {
      state.phase = "syncing";
    },
    projectsLoaded(state, action: PayloadAction<ProjectsLoaded>) {
      state.phase = "idle";
      state.loaded = true;
      state.offline = action.payload.offline;
      state.identityNeedsSync = false;
      state.projects = toStoredProjects(action.payload.projects);
      state.invites = [...action.payload.invites];
    },
    // A pass that produced no fresh views (offline with no cache, or a transient
    // failure): settle the phase without clobbering what is already shown.
    projectsSyncSettled(state, action: PayloadAction<{ offline: boolean }>) {
      state.phase = "idle";
      state.loaded = true;
      state.offline = action.payload.offline;
    },
    identityNeedsSyncSet(state) {
      state.phase = "idle";
      state.loaded = true;
      state.identityNeedsSync = true;
    },
    projectsReset() {
      return initialState;
    },
  },
});

export const {
  projectsSyncStarted,
  projectsLoaded,
  projectsSyncSettled,
  identityNeedsSyncSet,
  projectsReset,
} = projectsSlice.actions;
export default projectsSlice.reducer;
