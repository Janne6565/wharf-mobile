// Logic for the sign-in screen (mock 01). Two entries:
//   Google/GitHub — the system browser opens the backend's OAuth authorize
//     endpoint; on success it deep-links back with a device code that we exchange
//     for a session entirely in-app (see @/auth/oauthSignIn). No manual code typing.
//   Email — on-device zero-knowledge derivation + DIRECT login, then the vault
//     is fetched and unlocked with the same password in one flow, so the user
//     types it exactly once (see emailLogin for why argon2 still runs twice).
//
// t() lives here (not the screen) because the hook maps API failures to
// translated error messages directly (REACT.md exception).

import { zodResolver } from "@hookform/resolvers/zod";
import { useMutation, useQuery } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useForm } from "react-hook-form";
import { useTranslation } from "react-i18next";
import { z } from "zod";
import { getHttpStatus } from "@/api/httpError";
import { listOAuthProviders } from "@/api/wharf";
import { emailLogin } from "@/auth/emailLogin";
import { OAuthSignInError, oauthSignIn } from "@/auth/oauthSignIn";
import { establishSession } from "@/auth/session";
import { offerBiometricEnrollment } from "@/features/unlock/enrollmentOffer";
import { EMAIL_PATTERN } from "@/lib/validators";
import { unlockVaultWithPassword } from "@/vault/unlock";

export interface SignInValues {
  email: string;
  password: string;
}

// Display names for the social providers, used only in the failure message
// (the backend slugs are lower-case; the UI wants "GitHub", not "github").
const PROVIDER_LABELS: Record<string, string> = { google: "Google", github: "GitHub" };
function providerLabel(provider: string): string {
  return PROVIDER_LABELS[provider] ?? provider;
}

export function useSignInLogic() {
  const { t } = useTranslation();
  const router = useRouter();
  const [showEmailForm, setShowEmailForm] = useState(false);
  const [submitError, setSubmitError] = useState<string | null>(null);
  const [providerError, setProviderError] = useState<string | null>(null);

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

  // Which social buttons to enable — the backend only advertises providers it has
  // credentials for. While this loads (and if it fails) the buttons stay disabled.
  const providersQuery = useQuery({
    queryKey: ["oauth-providers"],
    queryFn: () => listOAuthProviders(),
  });
  const enabledProviders = providersQuery.data?.providers ?? [];

  // Browser device-code sign-in: open the provider, exchange the returned code for
  // a session, then let the routing guards take over (an OAuth account's vault is
  // still locked, so the user lands on the unlock screen — that is correct).
  const providerMutation = useMutation({
    mutationFn: async (provider: string) => {
      const outcome = await oauthSignIn(provider);
      if (outcome.status === "session") {
        await establishSession(outcome.session);
      }
      return outcome;
    },
    onError: (error: unknown, provider) => {
      if (error instanceof OAuthSignInError && error.code === "email_not_verified") {
        setProviderError(t("signIn.errors.oauthEmailUnverified"));
      } else {
        setProviderError(t("signIn.errors.oauthFailed", { provider: providerLabel(provider) }));
      }
    },
  });

  const signInWithProvider = useCallback(
    (provider: string) => {
      setProviderError(null);
      providerMutation.mutate(provider);
    },
    [providerMutation],
  );

  // Only the tapped button spins; every provider button is blocked while any
  // sign-in is in flight, while the providers list loads, or if it is disabled.
  const providerPending = providerMutation.isPending ? providerMutation.variables : undefined;
  const isProviderDisabled = useCallback(
    (provider: string) =>
      providersQuery.isLoading ||
      providerMutation.isPending ||
      !enabledProviders.includes(provider),
    [providersQuery.isLoading, providerMutation.isPending, enabledProviders],
  );

  const goToPair = useCallback(() => router.push("/pair"), [router]);

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
    signInWithProvider,
    isProviderDisabled,
    providerPending,
    providerError,
    goToPair,
    form,
    onSubmit,
    canSubmit,
    isSubmitting: mutation.isPending,
    submitError,
  };
}
