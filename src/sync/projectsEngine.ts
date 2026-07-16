// The projects sync orchestrator: drives the ProjectSyncEngine from the app's
// triggers and maps outcomes into the projects Redux slice. The projects analogue
// of engine.ts, but simpler — projects are read-only in v1, so there is no push
// debounce and no conflict plumbing.
//
// A full pass follows the plan's order: personal sync (fast-forward the personal
// vault so a just-arrived identity is visible) → identity ensure (bootstrap or the
// needs-sync notice) → projects pass (unwrap → open → cache → hosts) + invites.
// It is triggered lazily on the first Projects tab focus (not on every foreground)
// so a signed-in user who never opens Projects pays no identity/argon2 cost, and
// re-run after an accept/decline invite mutation.
//
// Single-flight with a trailing re-run mirrors engine.ts: a trigger during a pass
// joins the running promise and re-runs once afterwards if it represented new work.

import { store } from "@/store";
import {
  identityNeedsSyncSet,
  projectsLoaded,
  projectsSyncSettled,
  projectsSyncStarted,
} from "@/store/projectsSlice";
import { ensureIdentity } from "@/vault/identity";
import { runSync } from "./engine";
import { ProjectSyncEngine } from "./projects";
import { makeProjectSyncDeps } from "./projectsDeps";
import type { ProjectsOutcome } from "./projectTypes";

let running: Promise<void> | null = null;
let rerunQueued = false;

function eligible(): boolean {
  const state = store.getState();
  return state.auth.status === "authenticated" && state.vault.status === "unlocked";
}

function applyOutcome(outcome: ProjectsOutcome): void {
  if (outcome.kind === "offline") {
    if (outcome.views.length > 0) {
      store.dispatch(projectsLoaded({ projects: outcome.views, invites: [], offline: true }));
    } else {
      store.dispatch(projectsSyncSettled({ offline: true }));
    }
    return;
  }
  store.dispatch(
    projectsLoaded({ projects: outcome.views, invites: outcome.invites, offline: false }),
  );
}

async function doPass(): Promise<void> {
  store.dispatch(projectsSyncStarted());
  // Fast-forward the personal vault first, so an identity created on another
  // device is visible before we decide whether to bootstrap one here.
  await runSync();

  const expectedVersion = store.getState().vault.version ?? 0;
  const identity = await ensureIdentity(expectedVersion);
  if (identity.kind === "needs-sync") {
    store.dispatch(identityNeedsSyncSet());
    return;
  }

  const engine = new ProjectSyncEngine(makeProjectSyncDeps(identity.keys));
  applyOutcome(await engine.sync());
}

// runProjectsSync executes one full projects pass, single-flight with a trailing
// re-run. Safe to call on every Projects focus and after invite mutations.
export async function runProjectsSync(): Promise<void> {
  if (!eligible()) {
    return;
  }
  if (running) {
    rerunQueued = true;
    return running;
  }
  running = (async () => {
    do {
      rerunQueued = false;
      try {
        await doPass();
      } catch {
        // A transient network/protocol failure surfaces as offline without
        // clobbering whatever is already shown.
        store.dispatch(projectsSyncSettled({ offline: true }));
      }
    } while (rerunQueued && eligible());
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}
