import "@/i18n/config";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { listOAuthProviders } from "@/api/wharf";
import { OAuthSignInError, oauthSignIn } from "@/auth/oauthSignIn";
import { establishSession } from "@/auth/session";
import { store } from "@/store";
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
// expo-router pulls in ESM-only deps that Jest doesn't transform; the hook only
// needs router.push (for the pairing-code fallback), so stub it.
jest.mock("expo-router", () => ({
  useRouter: () => ({ push: jest.fn() }),
}));

const mockedOauth = oauthSignIn as jest.MockedFunction<typeof oauthSignIn>;
const mockedEstablish = establishSession as jest.MockedFunction<typeof establishSession>;
const mockedProviders = listOAuthProviders as jest.MockedFunction<typeof listOAuthProviders>;

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
