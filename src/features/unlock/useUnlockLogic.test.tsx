import "@/i18n/config";

import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { CryptoError } from "@/crypto/errors";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";
import { setBiometricEnrolled, vaultLocked } from "@/store/vaultSlice";
import { unlockVaultWithBiometrics, unlockVaultWithPassword } from "@/vault/unlock";
import { offerBiometricEnrollment } from "./enrollmentOffer";
import { useUnlockLogic } from "./useUnlockLogic";

jest.mock("@/vault/unlock", () => ({
  unlockVaultWithPassword: jest.fn(),
  unlockVaultWithBiometrics: jest.fn(),
}));
jest.mock("@/auth/session", () => ({
  clearSession: jest.fn(),
}));
jest.mock("./enrollmentOffer", () => ({
  offerBiometricEnrollment: jest.fn().mockResolvedValue(undefined),
}));

const mockedPasswordUnlock = unlockVaultWithPassword as jest.MockedFunction<
  typeof unlockVaultWithPassword
>;
const mockedBiometricUnlock = unlockVaultWithBiometrics as jest.MockedFunction<
  typeof unlockVaultWithBiometrics
>;
const mockedOffer = offerBiometricEnrollment as jest.MockedFunction<
  typeof offerBiometricEnrollment
>;

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}

async function submitPassword(result: { current: ReturnType<typeof useUnlockLogic> }) {
  await act(async () => {
    result.current.form.setValue("password", "hunter2");
  });
  await act(async () => {
    await result.current.onSubmit();
  });
}

describe("useUnlockLogic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(vaultLocked());
    store.dispatch(setBiometricEnrolled(false));
  });

  it("does not fire a biometric attempt when nothing is enrolled", async () => {
    await renderHook(() => useUnlockLogic(), { wrapper });
    await act(async () => {});
    expect(mockedBiometricUnlock).not.toHaveBeenCalled();
  });

  it("fires the biometric attempt once on mount when enrolled", async () => {
    store.dispatch(setBiometricEnrolled(true));
    mockedBiometricUnlock.mockResolvedValue({ status: "unlocked" });

    const { result, rerender } = await renderHook(() => useUnlockLogic(), { wrapper });
    await waitFor(() => expect(mockedBiometricUnlock).toHaveBeenCalledTimes(1));
    await rerender({});
    await act(async () => {});

    expect(mockedBiometricUnlock).toHaveBeenCalledTimes(1);
    expect(result.current.biometricEnrolled).toBe(true);
  });

  it("a cancelled/stale biometric attempt leaves the password fallback error-free", async () => {
    store.dispatch(setBiometricEnrolled(true));
    mockedBiometricUnlock.mockResolvedValue({ status: "unavailable" });

    const { result } = await renderHook(() => useUnlockLogic(), { wrapper });
    await waitFor(() => expect(mockedBiometricUnlock).toHaveBeenCalledTimes(1));

    expect(result.current.unlockError).toBeNull();
    expect(result.current.noVault).toBe(false);
  });

  it("password unlock success triggers the biometric enrolment offer", async () => {
    mockedPasswordUnlock.mockResolvedValue({ status: "unlocked" });

    const { result } = await renderHook(() => useUnlockLogic(), { wrapper });
    await submitPassword(result);

    expect(mockedPasswordUnlock).toHaveBeenCalledWith("hunter2");
    await waitFor(() => expect(mockedOffer).toHaveBeenCalledTimes(1));
    expect(result.current.unlockError).toBeNull();
  });

  it("a wrong password maps to the wrong-password error", async () => {
    mockedPasswordUnlock.mockRejectedValue(
      new CryptoError("wrong-secret", "wrong password or recovery code"),
    );

    const { result } = await renderHook(() => useUnlockLogic(), { wrapper });
    await submitPassword(result);

    await waitFor(() => expect(result.current.unlockError).toBe("Wrong master password."));
    expect(mockedOffer).not.toHaveBeenCalled();
  });

  it("a no-vault outcome flips the noVault branch", async () => {
    mockedPasswordUnlock.mockResolvedValue({ status: "no-vault" });

    const { result } = await renderHook(() => useUnlockLogic(), { wrapper });
    await submitPassword(result);

    await waitFor(() => expect(result.current.noVault).toBe(true));
    expect(mockedOffer).not.toHaveBeenCalled();
  });

  it("gates submit on password completeness", async () => {
    const { result } = await renderHook(() => useUnlockLogic(), { wrapper });
    expect(result.current.canSubmit).toBe(false);
    await act(async () => {
      result.current.form.setValue("password", "x");
    });
    await waitFor(() => expect(result.current.canSubmit).toBe(true));
  });
});
