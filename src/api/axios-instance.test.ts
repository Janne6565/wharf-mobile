// Behavioural tests for the 401 → silent-refresh-and-retry interceptor: the
// DIRECT-mode refresh, single-flight dedupe, the retry-once flag, auth-path
// exclusion, and refresh-token hygiene (rotate on success, drop only on
// explicit server rejection).

import type { AxiosRequestConfig, AxiosResponse } from "axios";
import { AxiosError, AxiosHeaders } from "axios";
import { clearRefreshToken, getRefreshToken, setRefreshToken } from "@/auth/refreshTokenStore";
import { getAccessToken, setAccessToken } from "@/auth/tokenStore";
import { AXIOS_INSTANCE } from "./axios-instance";

jest.mock("@/auth/refreshTokenStore", () => ({
  getRefreshToken: jest.fn(),
  setRefreshToken: jest.fn(),
  clearRefreshToken: jest.fn(),
}));

const mockedGetRefreshToken = getRefreshToken as jest.MockedFunction<typeof getRefreshToken>;
const mockedSetRefreshToken = setRefreshToken as jest.MockedFunction<typeof setRefreshToken>;
const mockedClearRefreshToken = clearRefreshToken as jest.MockedFunction<typeof clearRefreshToken>;

function ok(config: AxiosRequestConfig, data: unknown): AxiosResponse {
  return {
    data,
    status: 200,
    statusText: "OK",
    headers: {},
    config: { ...config, headers: new AxiosHeaders() },
  } as AxiosResponse;
}

// The adapter receives headers as either an AxiosHeaders instance or a plain
// object depending on the code path; normalise for assertions.
function authHeader(config: AxiosRequestConfig): string | undefined {
  const headers = config.headers;
  if (!headers) {
    return undefined;
  }
  if (headers instanceof AxiosHeaders) {
    const value = headers.get("Authorization");
    return typeof value === "string" ? value : undefined;
  }
  const value = (headers as Record<string, unknown>).Authorization;
  return typeof value === "string" ? value : undefined;
}

function httpError(config: AxiosRequestConfig, status: number): AxiosError {
  const response = {
    data: {},
    status,
    statusText: "",
    headers: {},
    config,
  } as AxiosResponse;
  return new AxiosError("request failed", "ERR_BAD_REQUEST", config as never, null, response);
}

describe("axios 401 refresh-retry interceptor", () => {
  let adapter: jest.Mock;

  beforeEach(() => {
    jest.clearAllMocks();
    setAccessToken("stale-access");
    mockedGetRefreshToken.mockResolvedValue("refresh-1");
    mockedSetRefreshToken.mockResolvedValue();
    mockedClearRefreshToken.mockResolvedValue();
    adapter = jest.fn();
    AXIOS_INSTANCE.defaults.adapter = adapter;
  });

  function wireAdapter({
    refreshStatus = 200,
    protectedFailsForever = false,
  }: {
    refreshStatus?: number;
    protectedFailsForever?: boolean;
  } = {}) {
    adapter.mockImplementation((config: AxiosRequestConfig) => {
      const url = config.url ?? "";
      if (url === "/api/v1/auth/refresh") {
        if (refreshStatus !== 200) {
          return Promise.reject(httpError(config, refreshStatus));
        }
        return Promise.resolve(
          ok(config, { accessToken: "fresh-access", refreshToken: "refresh-2" }),
        );
      }
      const auth = authHeader(config);
      if (auth === "Bearer fresh-access" && !protectedFailsForever) {
        return Promise.resolve(ok(config, { fine: true }));
      }
      return Promise.reject(httpError(config, 401));
    });
  }

  it("refreshes once and retries the original request with the new token", async () => {
    wireAdapter();

    const res = await AXIOS_INSTANCE.get("/api/v1/vault");

    expect(res.data).toEqual({ fine: true });
    expect(getAccessToken()).toBe("fresh-access");
    // Rotated refresh token persisted.
    expect(mockedSetRefreshToken).toHaveBeenCalledWith("refresh-2");
    const refreshCalls = adapter.mock.calls.filter(
      ([c]: [AxiosRequestConfig]) => c.url === "/api/v1/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
    // DIRECT mode with the stored token in the body.
    expect(JSON.parse(refreshCalls[0][0].data as string)).toEqual({
      refreshToken: "refresh-1",
      tokenMode: "DIRECT",
    });
  });

  it("deduplicates concurrent 401s into a single refresh (single-flight)", async () => {
    wireAdapter();

    const [a, b, c] = await Promise.all([
      AXIOS_INSTANCE.get("/api/v1/vault"),
      AXIOS_INSTANCE.get("/api/v1/users/me"),
      AXIOS_INSTANCE.get("/api/v1/users/me/invites"),
    ]);

    expect(a.data).toEqual({ fine: true });
    expect(b.data).toEqual({ fine: true });
    expect(c.data).toEqual({ fine: true });
    const refreshCalls = adapter.mock.calls.filter(
      ([cfg]: [AxiosRequestConfig]) => cfg.url === "/api/v1/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("retries at most once: a second 401 after refresh propagates", async () => {
    wireAdapter({ protectedFailsForever: true });

    await expect(AXIOS_INSTANCE.get("/api/v1/vault")).rejects.toMatchObject({
      response: { status: 401 },
    });
    const refreshCalls = adapter.mock.calls.filter(
      ([cfg]: [AxiosRequestConfig]) => cfg.url === "/api/v1/auth/refresh",
    );
    expect(refreshCalls).toHaveLength(1);
  });

  it("never refreshes for 401s from auth endpoints", async () => {
    adapter.mockImplementation((config: AxiosRequestConfig) =>
      Promise.reject(httpError(config, 401)),
    );

    await expect(
      AXIOS_INSTANCE.post("/api/v1/auth/login", { email: "x", authKey: "y" }),
    ).rejects.toMatchObject({ response: { status: 401 } });
    expect(adapter).toHaveBeenCalledTimes(1);
  });

  it("drops the stored refresh token when the server rejects it", async () => {
    wireAdapter({ refreshStatus: 401 });

    await expect(AXIOS_INSTANCE.get("/api/v1/vault")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(getAccessToken()).toBeNull();
    expect(mockedClearRefreshToken).toHaveBeenCalledTimes(1);
  });

  it("keeps the stored refresh token on a network failure during refresh", async () => {
    adapter.mockImplementation((config: AxiosRequestConfig) => {
      if (config.url === "/api/v1/auth/refresh") {
        return Promise.reject(new AxiosError("network down", "ERR_NETWORK", config as never));
      }
      return Promise.reject(httpError(config, 401));
    });

    await expect(AXIOS_INSTANCE.get("/api/v1/vault")).rejects.toMatchObject({
      response: { status: 401 },
    });
    expect(getAccessToken()).toBeNull();
    expect(mockedClearRefreshToken).not.toHaveBeenCalled();
  });
});
