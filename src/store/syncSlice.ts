import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { Conflict } from "@/sync/types";

// Derived, non-secret sync UI state. The engine's key material and the pending
// remote PAYLOAD live in module memory (src/sync); this slice carries only what
// the UI renders: whether a pass is running, whether we are offline, whether a
// pull needs a password re-prompt, and the conflict SUMMARY (host counts +
// remote version/timestamp — no payload bytes) that drives the conflict sheet.

export type SyncPhase = "idle" | "syncing";

interface SyncState {
  phase: SyncPhase;
  offline: boolean;
  // The last moved remote could not be adopted without the master password
  // (biometric-only session); the UI prompts for a password unlock.
  needsPassword: boolean;
  // Non-null while a both-sides-changed conflict awaits the user's choice.
  conflict: Conflict | null;
  lastSyncedAt: string | null;
}

const initialState: SyncState = {
  phase: "idle",
  offline: false,
  needsPassword: false,
  conflict: null,
  lastSyncedAt: null,
};

interface SyncFinished {
  readonly offline: boolean;
  readonly needsPassword: boolean;
}

const syncSlice = createSlice({
  name: "sync",
  initialState,
  reducers: {
    syncStarted(state) {
      state.phase = "syncing";
    },
    syncFinished(state, action: PayloadAction<SyncFinished>) {
      state.phase = "idle";
      state.offline = action.payload.offline;
      state.needsPassword = action.payload.needsPassword;
      if (!action.payload.offline) {
        state.lastSyncedAt = new Date().toISOString();
      }
    },
    syncConflictDetected(state, action: PayloadAction<Conflict>) {
      state.conflict = action.payload;
    },
    syncConflictResolved(state) {
      state.conflict = null;
    },
    setOffline(state, action: PayloadAction<boolean>) {
      state.offline = action.payload;
    },
    // Reset on lock / sign-out: no residual conflict or offline flag.
    syncReset() {
      return initialState;
    },
  },
});

export const {
  syncStarted,
  syncFinished,
  syncConflictDetected,
  syncConflictResolved,
  setOffline,
  syncReset,
} = syncSlice.actions;
export default syncSlice.reducer;
