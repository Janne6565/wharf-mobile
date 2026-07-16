import { useEffect, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { setBiometricEnrolled } from "@/store/vaultSlice";
import { clearBiometricDek } from "@/vault/biometric";
import { canOfferBiometricEnrollment, enrollBiometricsForSession } from "@/vault/unlock";

interface UseBiometricToggleParams {
  // The OS biometric prompt label, translated by the caller (Android shows it on
  // enrolment; iOS prompts on read).
  readonly enrollPrompt: string;
}

// Owns the Settings biometric-unlock toggle. `enrolled` mirrors the cached-DEK
// state from the vault slice; `available` gates the switch on device capability
// (hardware + OS enrolment) when nothing is cached yet. Toggling on enrolls the
// current session's DEK behind the biometric gate; toggling off drops it. Every
// outcome raises a toast so the switch never flips silently.
export function useBiometricToggle({ enrollPrompt }: UseBiometricToggleParams) {
  const dispatch = useAppDispatch();
  const enrolled = useAppSelector((state) => state.vault.biometricEnrolled);
  const [available, setAvailable] = useState(false);
  const [busy, setBusy] = useState(false);

  // A device can offer enrolment when it has biometric hardware with an OS
  // enrolment and no DEK cached yet. When already enrolled the toggle stays
  // usable (to disable), so availability only gates the not-yet-enrolled case.
  useEffect(() => {
    let active = true;
    void canOfferBiometricEnrollment().then((canOffer) => {
      if (active) {
        setAvailable(canOffer);
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
    // The switch is interactive when already enrolled (to turn off) or when the
    // device can enroll (to turn on), and never while a change is in flight.
    canToggle: (enrolled || available) && !busy,
    toggle,
  };
}
