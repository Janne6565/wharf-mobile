import { act, renderHook } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { store } from "@/store";
import { syncConflictDetected, syncReset } from "@/store/syncSlice";
import type { Conflict } from "@/sync/types";
import { formatRemoteUpdatedAt, useSyncConflictLogic } from "./useSyncConflictLogic";

jest.mock("@/sync/engine", () => ({ resolveConflict: jest.fn() }));

import { resolveConflict } from "@/sync/engine";

const mockedResolve = resolveConflict as jest.MockedFunction<typeof resolveConflict>;

function wrapper({ children }: { readonly children: ReactNode }) {
  return <Provider store={store}>{children}</Provider>;
}

const CONFLICT: Conflict = {
  localHosts: 3,
  remoteHosts: 2,
  remoteVersion: 8,
  remoteUpdatedAt: null,
};

describe("useSyncConflictLogic", () => {
  beforeEach(() => {
    store.dispatch(syncReset());
    jest.clearAllMocks();
  });

  it("exposes the pending conflict from the store", async () => {
    const { result, rerender } = await renderHook(() => useSyncConflictLogic(), { wrapper });
    expect(result.current.conflict).toBeNull();
    await act(async () => {
      store.dispatch(syncConflictDetected(CONFLICT));
    });
    await rerender({});
    expect(result.current.conflict).toEqual(CONFLICT);
  });

  it("keep-local resolves with keepLocal=true", async () => {
    const { result } = await renderHook(() => useSyncConflictLogic(), { wrapper });
    await act(async () => result.current.keepLocal());
    expect(mockedResolve).toHaveBeenCalledWith(true);
  });

  it("take-remote resolves with keepLocal=false", async () => {
    const { result } = await renderHook(() => useSyncConflictLogic(), { wrapper });
    await act(async () => result.current.takeRemote());
    expect(mockedResolve).toHaveBeenCalledWith(false);
  });
});

describe("formatRemoteUpdatedAt", () => {
  it("returns null for a missing or invalid timestamp", () => {
    expect(formatRemoteUpdatedAt(null)).toBeNull();
    expect(formatRemoteUpdatedAt("not-a-date")).toBeNull();
  });

  it("formats a valid ISO timestamp", () => {
    expect(formatRemoteUpdatedAt("2026-07-16T10:00:00Z")).toEqual(expect.any(String));
  });
});
