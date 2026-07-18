import reducer, { probeResulted, probeSweepStarted, probesReset } from "./probesSlice";

describe("probesSlice", () => {
  it("has an empty initial state", () => {
    const state = reducer(undefined, { type: "@@INIT" });
    expect(state).toEqual({ results: {}, lastSweepAt: null });
  });

  it("records the sweep start time", () => {
    const state = reducer(undefined, probeSweepStarted(1234));
    expect(state.lastSweepAt).toBe(1234);
  });

  it("records a per-host probe result keyed by host id", () => {
    const state = reducer(undefined, probeResulted({ hostId: "h1", status: "online", rttMs: 42 }));
    expect(state.results.h1).toEqual({ status: "online", rttMs: 42 });
  });

  it("overwrites a prior result for the same host", () => {
    const first = reducer(undefined, probeResulted({ hostId: "h1", status: "online", rttMs: 42 }));
    const second = reducer(first, probeResulted({ hostId: "h1", status: "offline", rttMs: -1 }));
    expect(second.results.h1).toEqual({ status: "offline", rttMs: -1 });
  });

  it("keeps results for other hosts when one is updated", () => {
    let state = reducer(undefined, probeResulted({ hostId: "h1", status: "online", rttMs: 10 }));
    state = reducer(state, probeResulted({ hostId: "h2", status: "degraded", rttMs: 900 }));
    expect(Object.keys(state.results).sort()).toEqual(["h1", "h2"]);
  });

  it("clears all state on reset (vault lock)", () => {
    let state = reducer(undefined, probeSweepStarted(999));
    state = reducer(state, probeResulted({ hostId: "h1", status: "online", rttMs: 5 }));
    state = reducer(state, probesReset());
    expect(state).toEqual({ results: {}, lastSweepAt: null });
  });
});
