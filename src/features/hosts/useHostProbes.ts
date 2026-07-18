// Drives the host-list reachability sweep. Given the hosts currently on screen,
// it TCP-probes each one (via the native wharf-ssh module) when the screen gains
// focus and writes the results into probesSlice, which the rows read for their
// status dot. Results are advisory, ephemeral UI state (see probesSlice); they
// are never persisted and cleared on vault lock.

import { useFocusEffect } from "expo-router";
import { useCallback } from "react";
import { useAppDispatch, useAppStore } from "@/store/hooks";
import { probeResulted, probeSweepStarted } from "@/store/probesSlice";
import { probe } from "../../../modules/wharf-ssh";
import { classifyProbe, PROBE_TIMEOUT_MS } from "./lib";

// One host to probe. `host` is the dial address and `port` its SSH port; `id` is
// the vault host id the result is keyed by.
export interface ProbeTarget {
  readonly id: string;
  readonly host: string;
  readonly port: number;
}

// Don't re-sweep more often than this on refocus — reachability changes slowly
// and each sweep is N blocking dials. A sweep still runs early if a target has no
// result yet (e.g. a newly added host).
export const PROBE_SWEEP_MIN_INTERVAL_MS = 30_000;

// Decide whether a focus should start a fresh sweep: never probed, the throttle
// window has elapsed, or some visible target is still unprobed.
function shouldSweep(
  targets: readonly ProbeTarget[],
  lastSweepAt: number | null,
  results: Readonly<Record<string, unknown>>,
  now: number,
): boolean {
  if (targets.length === 0) {
    return false;
  }
  if (lastSweepAt === null || now - lastSweepAt > PROBE_SWEEP_MIN_INTERVAL_MS) {
    return true;
  }
  return targets.some((target) => results[target.id] === undefined);
}

export function useHostProbes(targets: readonly ProbeTarget[]): void {
  const dispatch = useAppDispatch();
  const store = useAppStore();

  useFocusEffect(
    // Read the probe state imperatively (not via a selector) so writing results
    // back does not re-trigger this focus effect mid-sweep.
    useCallback(() => {
      const { lastSweepAt, results } = store.getState().probes;
      const now = Date.now();
      if (!shouldSweep(targets, lastSweepAt, results, now)) {
        return;
      }
      dispatch(probeSweepStarted(now));
      for (const target of targets) {
        void (async () => {
          try {
            const rttMs = await probe(target.host, target.port, PROBE_TIMEOUT_MS);
            dispatch(probeResulted({ hostId: target.id, status: classifyProbe(rttMs), rttMs }));
          } catch {
            // The native probe is absent on older dev-client builds, or the dial
            // machinery threw — leave this host "unknown" rather than guessing.
          }
        })();
      }
    }, [targets, dispatch, store]),
  );
}
