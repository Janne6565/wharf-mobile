import "@/i18n/config";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";
import { setBiometricEnrolled, vaultLocked } from "@/store/vaultSlice";
import { canEnrollBiometrics, clearBiometricDek } from "@/vault/biometric";
import { enrollBiometricsForSession } from "@/vault/unlock";
import { useBiometricToggle } from "./useBiometricToggle";

jest.mock("@/vault/biometric", () => ({
  canEnrollBiometrics: jest.fn(),
  clearBiometricDek: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/vault/unlock", () => ({
  enrollBiometricsForSession: jest.fn(),
}));

const mockedCanEnroll = canEnrollBiometrics as jest.MockedFunction<typeof canEnrollBiometrics>;
const mockedClearDek = clearBiometricDek as jest.MockedFunction<typeof clearBiometricDek>;
const mockedEnroll = enrollBiometricsForSession as jest.MockedFunction<
  typeof enrollBiometricsForSession
>;

const PROMPT = "Unlock with biometrics";

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}

function render() {
  return renderHook(() => useBiometricToggle({ enrollPrompt: PROMPT }), { wrapper });
}

describe("useBiometricToggle", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(vaultLocked());
    store.dispatch(setBiometricEnrolled(false));
  });

  it("keeps the switch re-enableable after disabling on a capable, enrolled device", async () => {
    // Device has biometric hardware + an OS enrolment, and a DEK is cached.
    mockedCanEnroll.mockResolvedValue(true);
    store.dispatch(setBiometricEnrolled(true));

    const { result } = await render();
    await waitFor(() => expect(result.current.available).toBe(true));
    expect(result.current.enrolled).toBe(true);
    expect(result.current.canToggle).toBe(true);

    await act(async () => {
      await result.current.toggle(false);
    });

    expect(mockedClearDek).toHaveBeenCalledTimes(1);
    // Availability is pure capability, so it survives the disable: the switch
    // stays interactive to turn biometrics back on.
    expect(result.current.enrolled).toBe(false);
    expect(result.current.available).toBe(true);
    expect(result.current.canToggle).toBe(true);
    expect(result.current.busy).toBe(false);
  });

  it("reports no availability on a device without biometric capability", async () => {
    mockedCanEnroll.mockResolvedValue(false);

    const { result } = await render();
    await act(async () => {});

    expect(result.current.available).toBe(false);
    expect(result.current.enrolled).toBe(false);
    // Not enrolled + not capable → the switch is dead (correctly, the device
    // genuinely cannot do biometrics).
    expect(result.current.canToggle).toBe(false);
  });

  it("enrolls and flags success when toggled on", async () => {
    mockedCanEnroll.mockResolvedValue(true);
    mockedEnroll.mockResolvedValue(true);
    const before = store.getState().toast.toasts.length;

    const { result } = await render();
    await waitFor(() => expect(result.current.available).toBe(true));

    await act(async () => {
      await result.current.toggle(true);
    });

    expect(mockedEnroll).toHaveBeenCalledWith(PROMPT);
    const toasts = store.getState().toast.toasts;
    expect(toasts.length).toBe(before + 1);
    expect(toasts.at(-1)).toMatchObject({
      messageKey: "toast.biometricsEnabled",
      kind: "success",
    });
    expect(result.current.busy).toBe(false);
  });
});
