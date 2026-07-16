// Logic for the sign-in screen (mock 01). Two entries:
//   Google/GitHub — the system browser opens the web app (which handles OAuth
//     and shows a pairing code), and the app routes to the pairing-code screen.
//   Email — on-device zero-knowledge derivation + DIRECT login, then the vault
//     is fetched and unlocked with the same password in one flow, so the user
//     types it exactly once (see emailLogin for why argon2 still runs twice).
//
// t() lives here (not the screen) because the hook maps API failures to
// translated error messages directly (REACT.md exception).

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import * as WebBrowser from "expo-web-browser";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { API_BASE } from "@/api/axios-instance";
import { getHttpStatus } from "@/api/httpError";
import { emailLogin } from "@/auth/emailLogin";
import { establishSession } from "@/auth/session";
import { offerBiometricEnrollment } from "@/features/unlock/enrollmentOffer";
import { EMAIL_PATTERN } from "@/lib/validators";
import { unlockVaultWithPassword } from "@/vault/unlock";

export interface SignInValues {
  email: string;
  password: string;
}

export function useSignInLogic() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);

  const schema = useMemo(
    () =>
      z.object({
        email: z
          .string()
          .min(1, t("signIn.errors.emailInvalid"))
          .regex(EMAIL_PATTERN, t("signIn.errors.emailInvalid")),
        password: z.string().min(1, t("signIn.errors.passwordRequired")),
      }),
    [t],
  );
  const form = useForm<SignInValues>({
    resolver: zodResolver(schema),
    defaultValues: { email: "", password: "" },
    mode: "onSubmit",
  });

  // OAuth accounts sign in on the web and hand the session over via a pairing
  // code; the browser opens on top and the code-entry screen waits beneath it.
  const openProviderSignIn = useCallback(() => {
    void WebBrowser.openBrowserAsync(API_BASE);
    router.push("/pair");
  }, [router]);

  const mutation = useMutation({
    mutationFn: async (values: SignInValues) => {
      const session = await emailLogin(values);
      await establishSession(session);
      // Reuse the just-typed password to unlock the freshly pulled vault; the
      // routing guards move the user straight to the tabs on success.
      return unlockVaultWithPassword(values.password);
    },
    onSuccess: (outcome) => {
      if (outcome.status === "unlocked") {
        void offerBiometricEnrollment({
          title: t("unlock.enrollTitle"),
          body: t("unlock.enrollBody"),
          accept: t("unlock.enrollAccept"),
          skip: t("unlock.enrollSkip"),
          prompt: t("unlock.biometricPrompt"),
        });
      }
      // "no-vault" needs no handling here: the user is authenticated + locked,
      // so the guards land them on the unlock screen, which explains the state.
    },
    onError: (error: unknown) => {
      const status = getHttpStatus(error);
      if (status === 401) {
        setSubmitError(t("signIn.errors.invalidCredentials"));
      } else if (status === 429) {
        setSubmitError(t("signIn.errors.rateLimited"));
      } else {
        setSubmitError(t("signIn.errors.generic"));
      }
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    setSubmitError(null);
    mutation.mutate(values);
  });

  const openEmailForm = useCallback(() => setShowEmailForm(true), []);
  const closeEmailForm = useCallback(() => {
    setSubmitError(null);
    form.reset();
    setShowEmailForm(false);
  }, [form]);

  const email = form.watch("email");
  const password = form.watch("password");
  // Completeness gate only — format errors surface on submit (REACT.md).
  const canSubmit = email.trim().length > 0 && password.length > 0;

  return {
    showEmailForm,
    openEmailForm,
    closeEmailForm,
    openProviderSignIn,
    form,
    onSubmit,
    canSubmit,
    isSubmitting: mutation.isPending,
    submitError,
  };
}
