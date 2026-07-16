// The shared Axios instance injected into every Orval-generated call. It owns the
// cross-cutting API concerns so they are configured once (AUTH.md):
//   1. base URL from EXPO_PUBLIC_API_BASE (generated paths already carry /api/v1),
//   2. attaching the in-memory Bearer identity token,
//   3. a silent refresh on 401 (DIRECT mode, refresh token from SecureStore),
//      retried once, with a single-flight guard so concurrent 401s share one
//      refresh — a port of the wharf-web/TUI interceptor.
//
// This module imports only leaf token stores (no session/store), so it stays free
// of import cycles with the auth layer. A hard refresh failure clears the tokens;
// the session layer observes the cleared access token via subscribeToken and
// flips the UI to anonymous.

import Axios, { type AxiosError, type AxiosRequestConfig, isAxiosError } from "axios";
import { clearRefreshToken, getRefreshToken, setRefreshToken } from "@/auth/refreshTokenStore";
import { clearAccessToken, getAccessToken, setAccessToken } from "@/auth/tokenStore";

// Origin of the backend API. Overridable per-build via EXPO_PUBLIC_API_BASE;
// defaults to the hosted deployment. Generated request paths already include the
// /api/v1 prefix, so this is the bare origin.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://wharf.jannekeipert.de";

const REFRESH_PATH = "/api/v1/auth/refresh";
// Auth endpoints must never trigger the refresh-and-retry loop: a 401 from them
// is a genuine credential failure, not an expired access token.
const AUTH_PREFIX = "/api/v1/auth/";

export const AXIOS_INSTANCE = Axios.create({
  baseURL: API_BASE,
});

AXIOS_INSTANCE.interceptors.request.use((config) => {
  const token = getAccessToken();
  if (token) {
    config.headers = config.headers ?? {};
    config.headers.Authorization = `Bearer ${token}`;
  }
  return config;
});

interface RetriableConfig extends AxiosRequestConfig {
  _retried?: boolean;
}

let refreshInFlight: Promise<string | null> | null = null;

interface RefreshBody {
  accessToken?: string;
  refreshToken?: string | null;
}

// refreshAccessToken performs one DIRECT-mode refresh, deduped: concurrent 401s
// all await the same in-flight promise, so exactly one refresh request goes out.
async function refreshAccessToken(): Promise<string | null> {
  if (!refreshInFlight) {
    refreshInFlight = runRefresh().finally(() => {
      refreshInFlight = null;
    });
  }
  return refreshInFlight;
}

async function runRefresh(): Promise<string | null> {
  const stored = await getRefreshToken();
  if (!stored) {
    clearAccessToken();
    return null;
  }
  try {
    // Call the endpoint directly (not through customInstance): REFRESH_PATH is
    // under AUTH_PREFIX so its own 401s never re-enter the retry loop.
    const res = await AXIOS_INSTANCE.post<RefreshBody>(REFRESH_PATH, {
      refreshToken: stored,
      tokenMode: "DIRECT",
    });
    const token = res.data.accessToken ?? null;
    setAccessToken(token);
    if (res.data.refreshToken) {
      await setRefreshToken(res.data.refreshToken);
    }
    return token;
  } catch (error) {
    clearAccessToken();
    // Only discard the stored refresh token when the server explicitly rejected
    // it — a network failure must not sign the user out permanently.
    const status = isAxiosError(error) ? error.response?.status : undefined;
    if (status === 401 || status === 403) {
      await clearRefreshToken();
    }
    return null;
  }
}

AXIOS_INSTANCE.interceptors.response.use(
  (response) => response,
  async (error: AxiosError) => {
    const original = error.config as RetriableConfig | undefined;
    const status = error.response?.status;
    const url = original?.url ?? "";
    const isAuthCall = url.startsWith(AUTH_PREFIX);

    if (status === 401 && original && !original._retried && !isAuthCall) {
      original._retried = true;
      const token = await refreshAccessToken();
      if (token) {
        return AXIOS_INSTANCE(original);
      }
    }
    return Promise.reject(error);
  },
);

// customInstance is Orval's mutator: every generated endpoint calls through it.
export const customInstance = <T>(
  config: AxiosRequestConfig,
  options?: AxiosRequestConfig,
): Promise<T> => {
  const source = Axios.CancelToken.source();
  const promise = AXIOS_INSTANCE({
    ...config,
    ...options,
    cancelToken: source.token,
  }).then(({ data }) => data as T);

  // Allow React Query to cancel in-flight requests.
  (promise as Promise<T> & { cancel?: () => void }).cancel = () => {
    source.cancel("Query was cancelled");
  };

  return promise;
};

export default customInstance;

export type ErrorType<Error> = AxiosError<Error>;
export type BodyType<BodyData> = BodyData;
