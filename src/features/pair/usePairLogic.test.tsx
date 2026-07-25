import "@/i18n/config";

import { QueryClient, QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import { AxiosError, AxiosHeaders } from "axios";
import type { ReactNode } from "react";
import { pairDevice } from "@/auth/pairing";
import { establishSession } from "@/auth/session";
import { usePairLogic } from "./usePairLogic";

jest.mock("@/auth/pairing", () => ({
  pairDevice: jest.fn(),
}));
jest.mock("@/auth/session", () => ({
  establishSession: jest.fn(),
}));

const mockedPair = pairDevice as jest.MockedFunction<typeof pairDevice>;
const mockedEstablish = establishSession as jest.MockedFunction<typeof establishSession>;

// Mirrors a backend Problem Details rejection, so the hook's `code` lookup runs
// against the same body layout it sees in production.
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
  // gcTime: 0 + the afterEach clear keeps React Query from leaving a cache-GC
  // timer open after the test, which would otherwise stall Jest's teardown.
  const client = new QueryClient({ defaultOptions: { queries: { retry: false, gcTime: 0 } } });
  clients.push(client);
  return function Wrapper({ children }: { readonly children: ReactNode }) {
    return <QueryClientProvider client={client}>{children}</QueryClientProvider>;
  };
}

async function submitCode(code = "ABCD-1234") {
  const { result } = await renderHook(() => usePairLogic(), { wrapper: makeWrapper() });
  await act(async () => {
    result.current.onChangeCode(code);
  });
  await act(async () => {
    result.current.onSubmit();
  });
  return result;
}

describe("usePairLogic", () => {
  beforeEach(() => jest.clearAllMocks());

  afterEach(() => {
    for (const client of clients.splice(0)) {
      client.clear();
    }
  });

  it("establishes a session for an accepted code", async () => {
    mockedPair.mockResolvedValue({ accessToken: "access", refreshToken: "refresh" });
    mockedEstablish.mockResolvedValue(undefined);

    const result = await submitCode();

    await waitFor(() => expect(mockedEstablish).toHaveBeenCalled());
    expect(mockedPair).toHaveBeenCalledWith("ABCD1234");
    expect(result.current.submitError).toBeNull();
  });

  // The backend rolls the exchange back on this rejection, so the code survives —
  // the message has to say the same code can be retried after verifying.
  it("explains an unverified account and that the code still works", async () => {
    mockedPair.mockRejectedValue(problemError(403, { code: "email_not_verified" }));

    const result = await submitCode();

    await waitFor(() =>
      expect(result.current.submitError).toBe(
        "This account isn't verified yet. Confirm your email at wharf.jannekeipert.de, then enter the same code again — it hasn't been used up.",
      ),
    );
    expect(mockedEstablish).not.toHaveBeenCalled();
  });

  it("keeps calling a plain 403 a bad code", async () => {
    mockedPair.mockRejectedValue(problemError(403, { detail: "Forbidden" }));

    const result = await submitCode();

    await waitFor(() =>
      expect(result.current.submitError).toBe("That code is invalid or expired."),
    );
  });

  it("reports rate limiting separately", async () => {
    mockedPair.mockRejectedValue(problemError(429, {}));

    const result = await submitCode();

    await waitFor(() =>
      expect(result.current.submitError).toBe("Too many attempts. Try again in a moment."),
    );
  });
});
