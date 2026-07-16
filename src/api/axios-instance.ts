// The shared Axios instance injected into every Orval-generated call. It owns the
// cross-cutting API concerns so they are configured once:
//   1. base URL from EXPO_PUBLIC_API_BASE (generated paths already carry /api/v1),
//   2. attaching the in-memory Bearer identity token.
//
// The 401 -> silent-refresh-and-retry interceptor (AUTH.md) is deferred to M2,
// together with the SecureStore-backed refresh token. See the TODO below.

import Axios, { type AxiosError, type AxiosRequestConfig } from "axios";
import { getAccessToken } from "@/auth/tokenStore";

// Origin of the backend API. Overridable per-build via EXPO_PUBLIC_API_BASE;
// defaults to the hosted deployment. Generated request paths already include the
// /api/v1 prefix, so this is the bare origin.
export const API_BASE = process.env.EXPO_PUBLIC_API_BASE ?? "https://wharf.jannekeipert.de";

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

// TODO(M2): add the response interceptor that, on a 401 from a non-auth call,
// runs a single silent refresh (refresh token from SecureStore) and retries the
// original request once — port of the wharf-web/TUI interceptor.

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
