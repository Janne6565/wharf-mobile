import "@/i18n/config";
import { screen } from "@testing-library/react-native";
import { getCurrentUser } from "@/api/wharf";
import { store } from "@/store";
import { sessionEstablished } from "@/store/authSlice";
import { renderWithProviders } from "@/test/renderWithProviders";
// Route-screen tests live in src/ (never app/) per the typed-routes caveat; the
// screen is imported relatively.
import SettingsScreen from "../../../app/(tabs)/settings/index";

jest.mock("expo-router", () => ({ useRouter: () => ({ push: jest.fn() }) }));
jest.mock("@/api/wharf", () => ({ getCurrentUser: jest.fn() }));
jest.mock("@/vault/biometric", () => ({
  canEnrollBiometrics: jest.fn().mockResolvedValue(false),
  clearBiometricDek: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/vault/unlock", () => ({
  lockVault: jest.fn(),
  enrollBiometricsForSession: jest.fn(),
}));

const mockedGetUser = getCurrentUser as jest.MockedFunction<typeof getCurrentUser>;

// The chevron renders as an <RNSVGSvgView> (lucide icon). It is the only icon a
// SettingsRow draws, so counting them counts navigating rows.
function chevronCount() {
  return JSON.stringify(screen.toJSON() ?? {}).split("RNSVGSvgView").length - 1;
}

describe("SettingsScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(sessionEstablished({ id: "u1", email: "deniz@acme.io" }));
    mockedGetUser.mockResolvedValue({
      email: "deniz@acme.io",
      hasPassword: false,
    } as Awaited<ReturnType<typeof getCurrentUser>>);
  });

  it("renders the sign-out row in the danger colour", async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(screen.getByText("Sign out").props.className).toContain("text-danger");
  });

  it("shows the lock-vault row with the ⌃L shortcut chip", async () => {
    await renderWithProviders(<SettingsScreen />);
    expect(screen.getByText("Lock vault")).toBeTruthy();
    expect(screen.getByText("⌃L")).toBeTruthy();
  });

  it("draws chevrons only on navigating rows, not on sign-out or lock-vault", async () => {
    await renderWithProviders(<SettingsScreen />);
    // Language + the dev-only Developer row navigate (chevron); Sign out (action)
    // and Lock vault (shortcut chip) must not add one. The old "pressable ⇒
    // chevron" behaviour would push this to 4.
    expect(chevronCount()).toBe(2);
  });
});
