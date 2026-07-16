// Logic for the unlock screen. Biometric-first when a DEK is enrolled (the
// prompt fires once on mount); the master-password form is always available as
// the fallback. A successful password unlock triggers the one-time biometric
// enrolment offer. t() lives here because the hook sets translated error
// messages directly (REACT.md exception).

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { clearSession } from "@/auth/session";
import { CryptoError } from "@/crypto";
import { useAppSelector } from "@/store/hooks";
import { unlockVaultWithBiometrics, unlockVaultWithPassword } from "@/vault/unlock";
import { offerBiometricEnrollment } from "./enrollmentOffer";

interface UnlockValues {
  password: string;
}

export function useUnlockLogic() {
  const { t } = useTranslation();
  const biometricEnrolled = useAppSelector((state) => state.vault.biometricEnrolled);
  const [noVault, setNoVault] = useState(false);
  const [unlockError, setUnlockError] = useState<string | null>(null);

  const schema = useMemo(
    () => z.object({ password: z.string().min(1, t("signIn.errors.passwordRequired")) }),
    [t],
  );
  const form = useForm<UnlockValues>({
    resolver: zodResolver(schema),
    defaultValues: { password: "" },
    mode: "onSubmit",
  });

  const passwordMutation = useMutation({
    mutationFn: (values: UnlockValues) => unlockVaultWithPassword(values.password),
    onSuccess: (outcome) => {
      if (outcome.status === "no-vault") {
        setNoVault(true);
        return;
      }
      void offerBiometricEnrollment({
        title: t("unlock.enrollTitle"),
        body: t("unlock.enrollBody"),
        accept: t("unlock.enrollAccept"),
        skip: t("unlock.enrollSkip"),
        prompt: t("unlock.biometricPrompt"),
      });
    },
    onError: (error: unknown) => {
      if (error instanceof CryptoError && error.code === "wrong-secret") {
        setUnlockError(t("unlock.errors.wrongPassword"));
      } else {
        setUnlockError(t("unlock.errors.generic"));
      }
    },
  });

  const biometricMutation = useMutation({
    mutationFn: () => unlockVaultWithBiometrics(t("unlock.biometricPrompt")),
    onSuccess: (outcome) => {
      if (outcome.status === "no-vault") {
        setNoVault(true);
      }
      // "unavailable" (cancelled / stale DEK) needs nothing: the password form
      // is already on screen as the fallback.
    },
    onError: () => setUnlockError(t("unlock.errors.generic")),
  });

  // Biometric-first: fire the system prompt once when the screen mounts with an
  // enrolled DEK. `mutate` is referentially stable across renders.
  const attempted = useRef(false);
  const { mutate: attemptBiometric } = biometricMutation;
  useEffect(() => {
    if (biometricEnrolled && !attempted.current) {
      attempted.current = true;
      attemptBiometric();
    }
  }, [biometricEnrolled, attemptBiometric]);

  const onSubmit = form.handleSubmit((values) => {
    setUnlockError(null);
    passwordMutation.mutate(values);
  });

  const onRetryBiometric = useCallback(() => {
    setUnlockError(null);
    attemptBiometric();
  }, [attemptBiometric]);

  const signOut = useCallback(() => {
    void clearSession();
  }, []);

  const password = form.watch("password");

  return {
    form,
    onSubmit,
    canSubmit: password.length > 0,
    isUnlocking: passwordMutation.isPending,
    isBiometricPending: biometricMutation.isPending,
    biometricEnrolled,
    onRetryBiometric,
    unlockError,
    noVault,
    signOut,
  };
}
