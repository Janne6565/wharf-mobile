import { renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { probesReset } from "@/store/probesSlice";
// The control surface lives only on the fake; import it directly (jest resolves
// the module the hook loads to this same instance).
import { __calls, __reset, __setProbeResult } from "../../../modules/wharf-ssh/index.node";
import { type ProbeTarget, useHostProbes } from "./useHostProbes";

// useFocusEffect runs its callback on mount here (react-navigation focus is a
// no-op under test), mirroring the projects screen test.
jest.mock("expo-router", () => {
  const react = require("react");
  return { useFocusEffect: (cb: () => void) => react.useEffect(cb, [cb]) };
});

function wrapper({ children }: { readonly children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}

const TARGETS: readonly ProbeTarget[] = [
  { id: "h1", host: "a.example.com", port: 22 },
  { id: "h2", host: "b.example.com", port: 2222 },
];

beforeEach(() => {
  __reset();
  store.dispatch(probesReset());
});

describe("useHostProbes", () => {
  it("probes every target on focus with the shared timeout", async () => {
    __setProbeResult(42);
    renderHook(() => useHostProbes(TARGETS), { wrapper });

    await waitFor(() => expect(__calls.probe).toHaveLength(2));
    expect(__calls.probe).toEqual([
      { host: "a.example.com", port: 22, timeoutMs: 3000 },
      { host: "b.example.com", port: 2222, timeoutMs: 3000 },
    ]);
  });

  it("classifies results and writes them into the store keyed by host id", async () => {
    __setProbeResult((_host, port) => (port === 22 ? 42 : -1));
    renderHook(() => useHostProbes(TARGETS), { wrapper });

    await waitFor(() => {
      const { results } = store.getState().probes;
      expect(results.h1).toEqual({ status: "online", rttMs: 42 });
      expect(results.h2).toEqual({ status: "offline", rttMs: -1 });
    });
  });

  it("classifies a slow dial as degraded", async () => {
    __setProbeResult(900);
    renderHook(() => useHostProbes([{ id: "h1", host: "slow", port: 22 }]), { wrapper });

    await waitFor(() => {
      expect(store.getState().probes.results.h1).toEqual({ status: "degraded", rttMs: 900 });
    });
  });

  it("leaves a host unknown when the native probe throws", async () => {
    __setProbeResult(() => {
      throw new Error("probe unavailable");
    });
    renderHook(() => useHostProbes([{ id: "h1", host: "x", port: 22 }]), { wrapper });

    await waitFor(() => expect(__calls.probe).toHaveLength(1));
    expect(store.getState().probes.results.h1).toBeUndefined();
  });

  it("does not sweep when there are no targets", async () => {
    renderHook(() => useHostProbes([]), { wrapper });
    // Give any stray async work a chance to run.
    await Promise.resolve();
    expect(__calls.probe).toHaveLength(0);
    expect(store.getState().probes.lastSweepAt).toBeNull();
  });
});
