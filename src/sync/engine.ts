// The sync orchestrator: owns the single PersonalSyncEngine instance and drives
// it from the app's triggers, mapping outcomes into the sync Redux slice.
//
// Guarantees (mirroring the TUI):
//   • Single-flight — never two concurrent passes. A trigger that fires mid-pass
//     joins the running promise and, if it represents new work (a mutation), a
//     trailing re-run fires once the current pass settles.
//   • Debounced push — local mutations schedule a pass ~3s later (the TUI's
//     debounce), coalescing a burst of edits into one upload.
//   • Triggers — app foreground (AppState "active") and connectivity return,
//     plus an initial pass when the engine starts (right after unlock).
//
// The engine instance is dropped on lock (stopSyncEngine), discarding any pending
// conflict along with the zeroed session.

import { AppState, type NativeEventSubscription } from "react-native";
import { store } from "@/store";
import {
  setOffline,
  syncConflictDetected,
  syncConflictResolved,
  syncFinished,
  syncReset,
  syncStarted,
} from "@/store/syncSlice";
import { subscribeConnectivity } from "./connectivity";
import { personalSyncDeps } from "./deps";
import { PersonalSyncEngine } from "./personal";
import type { PersonalOutcome } from "./types";

const DEBOUNCE_MS = 3000;

let engine: PersonalSyncEngine | null = null;
let running: Promise<void> | null = null;
let rerunQueued = false;
let debounceTimer: ReturnType<typeof setTimeout> | null = null;
let appStateSub: NativeEventSubscription | null = null;
let connectivityUnsub: (() => void) | null = null;

function getEngine(): PersonalSyncEngine {
  if (!engine) {
    engine = new PersonalSyncEngine(personalSyncDeps);
  }
  return engine;
}

function eligible(): boolean {
  const state = store.getState();
  return state.auth.status === "authenticated" && state.vault.status === "unlocked";
}

function applyOutcome(outcome: PersonalOutcome): void {
  switch (outcome.kind) {
    case "conflict":
      store.dispatch(syncConflictDetected(outcome.conflict));
      store.dispatch(syncFinished({ offline: false, needsPassword: false }));
      return;
    case "offline":
      store.dispatch(syncFinished({ offline: true, needsPassword: false }));
      return;
    case "needs-password":
      store.dispatch(syncFinished({ offline: false, needsPassword: true }));
      return;
    default:
      store.dispatch(syncFinished({ offline: false, needsPassword: false }));
  }
}

async function doPass(run: () => Promise<PersonalOutcome>): Promise<void> {
  store.dispatch(syncStarted());
  try {
    applyOutcome(await run());
  } catch {
    store.dispatch(syncFinished({ offline: true, needsPassword: false }));
  }
}

// runSync executes one sync pass, single-flight with a trailing re-run: a call
// that arrives while a pass is running marks a re-run and joins the in-flight
// promise, so work queued during a pass (e.g. a debounced push firing mid-sync)
// is not lost.
export async function runSync(): Promise<void> {
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
      await doPass(() => getEngine().sync());
    } while (rerunQueued && eligible());
  })();
  try {
    await running;
  } finally {
    running = null;
  }
}

// scheduleSyncPush debounces a sync after a local mutation, coalescing bursts.
export function scheduleSyncPush(): void {
  if (debounceTimer) {
    clearTimeout(debounceTimer);
  }
  debounceTimer = setTimeout(() => {
    debounceTimer = null;
    void runSync();
  }, DEBOUNCE_MS);
}

// resolveConflict settles the pending conflict sheet (keep-local / take-remote)
// on the same engine instance that stashed the remote payload.
export async function resolveConflict(keepLocal: boolean): Promise<void> {
  store.dispatch(syncConflictResolved());
  if (!engine || !eligible()) {
    return;
  }
  await doPass(() => getEngine().resolve(keepLocal));
}

// startSyncEngine wires the triggers and fires an initial pass (called once the
// vault is unlocked). Idempotent.
export function startSyncEngine(): void {
  if (appStateSub || connectivityUnsub) {
    return;
  }
  appStateSub = AppState.addEventListener("change", (appState) => {
    if (appState === "active") {
      void runSync();
    }
  });
  connectivityUnsub = subscribeConnectivity((online) => {
    store.dispatch(setOffline(!online));
    if (online) {
      void runSync();
    }
  });
  void runSync();
}

// stopSyncEngine tears down triggers and drops the engine instance (and its
// pending conflict) — called on lock / sign-out, when the session is zeroed.
export function stopSyncEngine(): void {
  appStateSub?.remove();
  appStateSub = null;
  connectivityUnsub?.();
  connectivityUnsub = null;
  if (debounceTimer) {
    clearTimeout(debounceTimer);
    debounceTimer = null;
  }
  engine = null;
  rerunQueued = false;
  store.dispatch(syncReset());
}
