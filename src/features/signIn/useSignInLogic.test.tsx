import "@/i18n/config";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { listOAuthProviders } from "@/api/wharf";
import { emailLogin } from "@/auth/emailLogin";
import { OAuthSignInError, oauthSignIn } from "@/auth/oauthSignIn";
import { establishSession } from "@/auth/session";
import { store } from "@/store";
import { unlockVaultWithPassword } from "@/vault/unlock";
import { useSignInLogic } from "./useSignInLogic";

// Keep the real OAuthSignInError (the hook narrows failures with instanceof) but
// stub the browser round-trip.
jest.mock("@/auth/oauthSignIn", () => {
  const actual = jest.requireActual("@/auth/oauthSignIn");
  return { ...actual, oauthSignIn: jest.fn() };
});
jest.mock("@/auth/session", () => ({
  establishSession: jest.fn(),
}));
jest.mock("@/api/wharf", () => ({
  listOAuthProviders: jest.fn(),
}));
// The email path is exercised through its two seams only — the derivation itself
// (argon2) is covered in emailLogin.test.ts and is far too slow to re-run here.
jest.mock("@/auth/emailLogin", () => ({
  emailLogin: jest.fn(),
}));
jest.mock("@/vault/unlock", () => ({
  unlockVaultWithPassword: jest.fn(),
}));
// expo-router pulls in ESM-only deps that Jest doesn't transform; the hook only
// needs router.push (for the pairing-code fallback), so stub it.
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockedOauth = oauthSignIn as jest.MockedFunction<typeof oauthSignIn>;
const mockedEstablish = establishSession as jest.MockedFunction<typeof establishSession>;
const mockedProviders = listOAuthProviders as jest.MockedFunction<typeof listOAuthProviders>;
const mockedEmailLogin = emailLogin as jest.MockedFunction<typeof emailLogin>;
const mockedUnlock = unlockVaultWithPassword as jest.MockedFunction<typeof unlockVaultWithPassword>;

// A rejection shaped like a real backend Problem Details response, so the hook's
// `code` lookup runs against the same body layout it sees in production.
function problemError(status: number, body: unknown): AxiosError {
  return new AxiosError("rejected", "ERR_BAD_RESPONSE", undefined, undefined, {
    status,
    statusText: "",
    data: body,
    headers: new AxiosHeaders(),
    config: { headers: new AxiosHeaders() },
  });
}

const clients: QueryClient[] = [];
function makeWrapper() {
  // gcTime: 0 + an afterEach clear keeps React Query from leaving a cache-GC
  // timer open after the test, which would otherwise stall Jest's teardown.
  const client = new QueryClient({
    defaultOptions: { queries: { retry: false, gcTime: 0 } },
  });
  clients.push(client);
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return (
      <Provider store={store}>
        <QueryClientProvider client={client}>{children}</QueryClientProvider>
      </Provider>
    );
  };
}

describe("useSignInLogic — provider sign-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedProviders.mockResolvedValue({ providers: ["google", "github"] });
  });

  afterEach(() => {
    for (const client of clients.splice(0)) {
      client.clear();
    }
  });

  it("enables only the advertised providers once the list loads", async () => {
    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });

    // Disabled while the providers query is in flight.
    expect(result.current.isProviderDisabled("google")).toBe(true);
    await waitFor(() => expect(result.current.isProviderDisabled("google")).toBe(false));
    expect(result.current.isProviderDisabled("github")).toBe(false);
  });

  it("keeps a provider disabled when the backend does not advertise it", async () => {
    mockedProviders.mockResolvedValue({ providers: ["google"] });
    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });

    await waitFor(() => expect(result.current.isProviderDisabled("google")).toBe(false));
    expect(result.current.isProviderDisabled("github")).toBe(true);
  });

  it("establishes a session on a successful provider sign-in", async () => {
    const session = { accessToken: "access", refreshToken: "refresh" };
    mockedOauth.mockResolvedValue({ status: "session", session });
    mockedEstablish.mockResolvedValue(undefined);

    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.signInWithProvider("google");
    });

    await waitFor(() => expect(mockedEstablish).toHaveBeenCalledWith(session));
    expect(mockedOauth).toHaveBeenCalledWith("google");
    expect(result.current.providerError).toBeNull();
  });

  it("does nothing on a cancelled sign-in", async () => {
    mockedOauth.mockResolvedValue({ status: "cancelled" });

    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.signInWithProvider("google");
    });

    await waitFor(() => expect(result.current.providerPending).toBeUndefined());
    expect(mockedEstablish).not.toHaveBeenCalled();
    expect(result.current.providerError).toBeNull();
  });

  it("shows the dedicated message for an unverified email", async () => {
    mockedOauth.mockRejectedValue(new OAuthSignInError("email_not_verified"));

    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.signInWithProvider("github");
    });

    await waitFor(() =>
      expect(result.current.providerError).toBe(
        "Verify your email with your provider, then try again.",
      ),
    );
    expect(mockedEstablish).not.toHaveBeenCalled();
  });

  it("explains the unverified-account conflict instead of blaming the provider", async () => {
    mockedOauth.mockRejectedValue(new OAuthSignInError("unverified_account_conflict"));

    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.signInWithProvider("google");
    });

    await waitFor(() =>
      expect(result.current.providerError).toBe(
        "An unverified Wharf account already uses this email. Verify it at wharf.jannekeipert.de, then try again.",
      ),
    );
  });

  it("explains an unverified local account behind the provider identity", async () => {
    mockedOauth.mockRejectedValue(new OAuthSignInError("account_not_verified"));

    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.signInWithProvider("github");
    });

    await waitFor(() =>
      expect(result.current.providerError).toBe(
        "This account isn't verified yet. Confirm your email at wharf.jannekeipert.de, then try again.",
      ),
    );
  });

  // The redirect succeeded and carried a device code; the *exchange* is what the
  // backend refused, so the failure arrives as a plain Axios problem response.
  it("maps a rejected device-code exchange to the unverified-email message", async () => {
    mockedOauth.mockRejectedValue(problemError(403, { code: "email_not_verified" }));

    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.signInWithProvider("google");
    });

    await waitFor(() =>
      expect(result.current.providerError).toBe(
        "This account isn't verified yet. Check your inbox and confirm your email at wharf.jannekeipert.de, then sign in here.",
      ),
    );
  });

  it("shows a generic per-provider message for any other failure", async () => {
    mockedOauth.mockRejectedValue(new OAuthSignInError("server_error"));

    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.signInWithProvider("google");
    });

    await waitFor(() =>
      expect(result.current.providerError).toBe("Couldn't sign in with Google. Try again."),
    );
  });
});

describe("useSignInLogic — email sign-in", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedProviders.mockResolvedValue({ providers: [] });
    mockedUnlock.mockResolvedValue({ status: "unlocked" });
  });

  afterEach(() => {
    for (const client of clients.splice(0)) {
      client.clear();
    }
  });

  async function submitCredentials() {
    const { result } = await renderHook(() => useSignInLogic(), { wrapper: makeWrapper() });
    await act(async () => {
      result.current.form.setValue("email", "deniz@acme.io");
      result.current.form.setValue("password", "hunter2");
    });
    await act(async () => {
      await result.current.onSubmit();
    });
    return result;
  }

  it("points an unverified account at the web app", async () => {
    mockedEmailLogin.mockRejectedValue(problemError(403, { code: "email_not_verified" }));

    const result = await submitCredentials();

    await waitFor(() =>
      expect(result.current.submitError).toBe(
        "This account isn't verified yet. Check your inbox and confirm your email at wharf.jannekeipert.de, then sign in here.",
      ),
    );
    expect(mockedEstablish).not.toHaveBeenCalled();
  });

  // A 403 is only the verification rejection when it says so: branching on the
  // status alone would mislabel any other forbidden response.
  it("keeps the generic message for a 403 without the verification code", async () => {
    mockedEmailLogin.mockRejectedValue(problemError(403, { detail: "Forbidden" }));

    const result = await submitCredentials();

    await waitFor(() =>
      expect(result.current.submitError).toBe(
        "Sign-in failed. Check your connection and try again.",
      ),
    );
  });

  it("still reports bad credentials on a 401", async () => {
    mockedEmailLogin.mockRejectedValue(problemError(401, { code: "invalid_credentials" }));

    const result = await submitCredentials();

    await waitFor(() => expect(result.current.submitError).toBe("Email or password is incorrect."));
  });
});
