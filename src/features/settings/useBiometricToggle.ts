import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { setBiometricEnrolled } from "@/store/vaultSlice";
import { canEnrollBiometrics, clearBiometricDek } from "@/vault/biometric";
import { enrollBiometricsForSession } from "@/vault/unlock";

interface UseBiometricToggleParams {
  // The OS biometric prompt label, translated by the caller (Android shows it on
  // enrolment; iOS prompts on read).
  readonly enrollPrompt: string;
}

// Owns the Settings biometric-unlock toggle. `enrolled` mirrors the cached-DEK
// state from the vault slice; `available` reports pure device capability
// (biometric hardware + an OS enrolment) and is independent of whether a DEK is
// currently cached — so disabling biometrics on a capable device leaves the
// switch re-enableable. Toggling on enrolls the current session's DEK behind the
// biometric gate; toggling off drops it. Every outcome raises a toast so the
// switch never flips silently.
export function useBiometricToggle({ enrollPrompt }: UseBiometricToggleParams) {
  const dispatch = useAppDispatch();
  const enrolled = useAppSelector((state) => state.vault.biometricEnrolled);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  // Device capability only: biometric hardware present with an OS enrolment.
  // This must NOT depend on the cached-DEK state, otherwise disabling biometrics
  // would strand the switch off (nothing enrolled + captured-false availability).
  useEffect(() => {
    let active = true;
    void canEnrollBiometrics().then((capable) => {
      if (active) {
        setAvailable(capable);
      }
    });
    return () => {
      active = false;
    };
  }, []);

  const toggle = async (next: boolean) => {
    if (busy) {
      return;
    }
    setBusy(true);
    try {
      if (next) {
        const ok = await enrollBiometricsForSession(enrollPrompt);
        dispatch(
          showToast({
            messageKey: ok ? "toast.biometricsEnabled" : "toast.biometricsFailed",
            kind: ok ? "success" : "error",
          }),
        );
      } else {
        await clearBiometricDek();
        dispatch(setBiometricEnrolled(false));
        dispatch(showToast({ messageKey: "toast.biometricsDisabled", kind: "info" }));
      }
    } catch {
      dispatch(showToast({ messageKey: "toast.biometricsFailed", kind: "error" }));
    } finally {
      setBusy(false);
    }
  };

  return {
    enrolled,
    // Pure device capability — the screen shows the "unavailable" value only when
    // this is false, never for the enrolled/busy cases.
    available,
    busy,
    // The switch is interactive when already enrolled (to turn off) or when the
    // device can enroll (to turn on), and never while a change is in flight.
    canToggle: (enrolled || available) && !busy,
    toggle,
  };
}
