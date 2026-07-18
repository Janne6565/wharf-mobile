import { createSlice, type PayloadAction } from "@reduxjs/toolkit";
import type { ProbeStatus } from "@/features/hosts/lib";

// Advisory host reachability state for the host-list status dot (parity with the
// wharf-tui probe). Results are EPHEMERAL UI state and are NEVER persisted — an
// "offline" host can still be connected to; the dot is only a hint. The sweep
// hook (useHostProbes) writes here; the Hosts tab and project detail read it.
//
// Reset on lock (probesReset), mirroring projectsSlice/vaultSlice: a locked vault
// must not keep stale reachability around behind the unlock screen.

interface ProbeResult {
  status: ProbeStatus;
  // Dial RTT in milliseconds; meaningless (and unused) for an offline result.
  rttMs: number;
}

interface ProbesState {
  // Keyed by host id. Absent id = unprobed → the UI renders "unknown" (grey).
  results: Record<string, ProbeResult>;
  // When the most recent sweep began, used to throttle re-sweeps. Null before the
  // first sweep of an unlocked session.
  lastSweepAt: number | null;
}

const initialState: ProbesState = {
  results: {},
  lastSweepAt: null,
};

const probesSlice = createSlice({
  name: "probes",
  initialState,
  reducers: {
    // Marks the start of a sweep (payload: Date.now()), so the hook can throttle
    // re-sweeps without waiting for every per-host result to land.
    probeSweepStarted(state, action: PayloadAction<number>) {
      state.lastSweepAt = action.payload;
    },
    // Records one host's probe outcome. Fired once per target per sweep.
    probeResulted(
      state,
      action: PayloadAction<{ hostId: string; status: ProbeStatus; rttMs: number }>,
    ) {
      const { hostId, status, rttMs } = action.payload;
      state.results[hostId] = { status, rttMs };
    },
    probesReset() {
      return initialState;
    },
  },
});

export const { probeSweepStarted, probeResulted, probesReset } = probesSlice.actions;
export default probesSlice.reducer;
