import { LoginRequestTokenMode } from "@/api/generated/model";
import { login } from "@/api/wharf";
import { emailLogin } from "./emailLogin";

jest.mock("@/api/wharf", () => ({
  login: jest.fn(),
}));

const mockedLogin = login as jest.MockedFunction<typeof login>;

describe("emailLogin", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    mockedLogin.mockResolvedValue({
      user: { id: "u1", email: "deniz@acme.io" },
      accessToken: "access",
      refreshToken: "refresh",
    });
  });

  // The pinned vector from keys.test.ts: the full on-device derivation
  // (argon2id over the email-salted password → HKDF auth key) must produce
  // exactly this authKey — and the raw password must never reach the API call.
  it("derives the pinned authKey vector and logs in with DIRECT tokens", async () => {
    const session = await emailLogin({ email: "  Deniz@ACME.io ", password: "hunter2" });

    expect(mockedLogin).toHaveBeenCalledTimes(1);
    expect(mockedLogin).toHaveBeenCalledWith({
      email: "deniz@acme.io",
      authKey: "nnzMcXPLofscNtfrXSFz0S7zt0yd1mkTzy0Gw7JWXH8=",
      tokenMode: LoginRequestTokenMode.DIRECT,
    });
    expect(session.accessToken).toBe("access");
  }, 30_000);

  it("never sends the password itself", async () => {
    await emailLogin({ email: "deniz@acme.io", password: "hunter2" });
    const body = mockedLogin.mock.calls[0][0];
    expect(JSON.stringify(body)).not.toContain("hunter2");
  }, 30_000);
});
