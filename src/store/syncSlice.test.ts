import type { Conflict } from "@/sync/types";
import reducer, {
  setOffline,
  syncConflictDetected,
  syncConflictResolved,
  syncFinished,
  syncReset,
  syncStarted,
} from "./syncSlice";

const CONFLICT: Conflict = {
  localHosts: 1,
  remoteHosts: 2,
  remoteVersion: 4,
  remoteUpdatedAt: null,
};

describe("syncSlice", () => {
  const initial = reducer(undefined, { type: "@@init" });

  it("starts idle, online, no conflict", () => {
    expect(initial).toMatchObject({
      phase: "idle",
      offline: false,
      needsPassword: false,
      conflict: null,
    });
  });

  it("syncStarted flips to syncing", () => {
    expect(reducer(initial, syncStarted()).phase).toBe("syncing");
  });

  it("syncFinished records offline/needsPassword and stamps lastSyncedAt only when online", () => {
    const online = reducer(initial, syncFinished({ offline: false, needsPassword: false }));
    expect(online).toMatchObject({ phase: "idle", offline: false });
    expect(online.lastSyncedAt).not.toBeNull();

    const offline = reducer(initial, syncFinished({ offline: true, needsPassword: false }));
    expect(offline).toMatchObject({ offline: true, lastSyncedAt: null });

    const needsPw = reducer(initial, syncFinished({ offline: false, needsPassword: true }));
    expect(needsPw.needsPassword).toBe(true);
  });

  it("tracks and clears a conflict", () => {
    const withConflict = reducer(initial, syncConflictDetected(CONFLICT));
    expect(withConflict.conflict).toEqual(CONFLICT);
    expect(reducer(withConflict, syncConflictResolved()).conflict).toBeNull();
  });

  it("setOffline toggles the connectivity flag", () => {
    expect(reducer(initial, setOffline(true)).offline).toBe(true);
  });

  it("syncReset returns to the initial state", () => {
    const dirty = reducer(reducer(initial, syncConflictDetected(CONFLICT)), setOffline(true));
    expect(reducer(dirty, syncReset())).toEqual(initial);
  });
});
