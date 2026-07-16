import * as WebBrowser from "expo-web-browser";
import { API_BASE } from "@/api/axios-instance";
import { pairDevice } from "@/auth/pairing";
import {
  buildAuthorizeUrl,
  OAuthSignInError,
  oauthSignIn,
  parseOAuthRedirect,
} from "./oauthSignIn";

jest.mock("expo-web-browser", () => ({
  openAuthSessionAsync: jest.fn(),
  // Preserve the result-type enum the SUT and these tests compare against.
  WebBrowserResultType: {
    CANCEL: "cancel",
    DISMISS: "dismiss",
    OPENED: "opened",
    LOCKED: "locked",
  },
}));
jest.mock("@/auth/pairing", () => ({
  pairDevice: jest.fn(),
}));

const mockedOpen = WebBrowser.openAuthSessionAsync as jest.MockedFunction<
  typeof WebBrowser.openAuthSessionAsync
>;
const mockedPair = pairDevice as jest.MockedFunction<typeof pairDevice>;

describe("buildAuthorizeUrl", () => {
  it("targets the backend authorize endpoint with the mobile client flag", () => {
    expect(buildAuthorizeUrl("google")).toBe(
      `${API_BASE}/api/v1/auth/oauth/google/authorize?client=mobile`,
    );
    expect(buildAuthorizeUrl("github")).toBe(
      `${API_BASE}/api/v1/auth/oauth/github/authorize?client=mobile`,
    );
  });
});

describe("parseOAuthRedirect", () => {
  it("extracts a device code", () => {
    expect(parseOAuthRedirect("wharf://oauth?code=ABCD1234")).toEqual({
      status: "code",
      code: "ABCD1234",
    });
  });

  it("maps each documented error code through unchanged", () => {
    for (const code of [
      "provider_disabled",
      "email_not_verified",
      "provider_error",
      "server_error",
    ]) {
      expect(parseOAuthRedirect(`wharf://oauth?error=${code}`)).toEqual({
        status: "error",
        error: code,
      });
    }
  });

  it("collapses an unrecognised error code to 'unknown'", () => {
    expect(parseOAuthRedirect("wharf://oauth?error=teapot")).toEqual({
      status: "error",
      error: "unknown",
    });
  });

  it("treats a redirect with neither code nor error as an unknown error", () => {
    expect(parseOAuthRedirect("wharf://oauth")).toEqual({ status: "error", error: "unknown" });
  });

  it("prefers a present code over any error param", () => {
    expect(parseOAuthRedirect("wharf://oauth?code=XYZ&error=server_error")).toEqual({
      status: "code",
      code: "XYZ",
    });
  });
});

describe("oauthSignIn", () => {
  beforeEach(() => jest.clearAllMocks());

  it("exchanges the returned code for a session on success", async () => {
    mockedOpen.mockResolvedValue({ type: "success", url: "wharf://oauth?code=PAIR1234" });
    mockedPair.mockResolvedValue({ accessToken: "access", refreshToken: "refresh" });

    const outcome = await oauthSignIn("google");

    expect(mockedOpen).toHaveBeenCalledWith(buildAuthorizeUrl("google"), "wharf://oauth");
    expect(mockedPair).toHaveBeenCalledWith("PAIR1234");
    expect(outcome).toEqual({
      status: "session",
      session: { accessToken: "access", refreshToken: "refresh" },
    });
  });

  it("throws a typed error carrying the backend error code", async () => {
    mockedOpen.mockResolvedValue({
      type: "success",
      url: "wharf://oauth?error=email_not_verified",
    });

    await expect(oauthSignIn("github")).rejects.toMatchObject({
      name: "OAuthSignInError",
      code: "email_not_verified",
    });
    expect(mockedPair).not.toHaveBeenCalled();
  });

  it("reports a silent cancel when the browser is dismissed", async () => {
    mockedOpen.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.CANCEL });

    await expect(oauthSignIn("google")).resolves.toEqual({ status: "cancelled" });
    expect(mockedPair).not.toHaveBeenCalled();
  });

  it("treats a dismiss the same as a cancel", async () => {
    mockedOpen.mockResolvedValue({ type: WebBrowser.WebBrowserResultType.DISMISS });

    await expect(oauthSignIn("google")).resolves.toEqual({ status: "cancelled" });
  });

  it("exposes OAuthSignInError as an Error subclass", () => {
    expect(new OAuthSignInError("server_error")).toBeInstanceOf(Error);
  });
});
