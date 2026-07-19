import "@/i18n/config";
import { fireEvent, screen } from "@testing-library/react-native";
import * as Clipboard from "expo-clipboard";
import { store } from "@/store";
import { syncReset, syncStarted } from "@/store/syncSlice";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { VaultKeyMeta } from "@/vault/document";
// Route-screen tests live in src/ (never app/) per the typed-routes caveat; the
// screen is imported relatively.
import KeysScreen from "../../../app/(tabs)/keys/index";

jest.mock("expo-router", () => {
  const react = require("react");
  return { useFocusEffect: (cb: () => void) => react.useEffect(cb, [cb]) };
});
jest.mock("expo-clipboard", () => ({ setStringAsync: jest.fn() }));

const mockedSetString = Clipboard.setStringAsync as jest.MockedFunction<
  typeof Clipboard.setStringAsync
>;

// A fixed authorized_keys line + its ssh-keygen SHA256 fingerprint (see lib.test).
const PUBLIC_KEY =
  "ssh-ed25519 AAAAC3NzaC1lZDI1NTE5AAAAIFAC5/HFXwgTZfFm6BWroF68v0V4V4ywkb1xFf/5Fr0g wharf-test@example";
const FINGERPRINT = "SHA256:LuRnyOyNpWKBUpnUVpqlIW1G7wTYFY3nGfiRouwFln4";

const KEY: VaultKeyMeta = {
  id: "k1",
  name: "id_ed25519",
  type: "ED25519",
  publicKey: PUBLIC_KEY,
  addedAt: "2026-07-19T00:00:00Z",
};

describe("KeysScreen", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    store.dispatch(vaultLocked());
    // Keep the sync phase idle by default so the empty-state tests do not pick up
    // a leaked "syncing" phase from the skeleton test (the store is a singleton).
    store.dispatch(syncReset());
  });

  it("shows the empty state when there are no synced keys and no first pass in flight", async () => {
    store.dispatch(vaultUnlocked({ hosts: [], keys: [], version: 0 }));
    await renderWithProviders(<KeysScreen />);
    expect(screen.getByText("Nothing synced yet")).toBeTruthy();
  });

  it("shows the first-load skeleton (not the empty state) while the first sync runs", async () => {
    store.dispatch(vaultUnlocked({ hosts: [], keys: [], version: 0 }));
    // A first personal sync is in flight and nothing is on screen yet.
    store.dispatch(syncStarted());
    await renderWithProviders(<KeysScreen />);

    expect(screen.getByTestId("keys-skeleton")).toBeTruthy();
    expect(screen.queryByText("Nothing synced yet")).toBeNull();
  });

  it("lists a synced key with its type pill, name and fingerprint", async () => {
    store.dispatch(vaultUnlocked({ hosts: [], keys: [KEY], version: 0 }));
    await renderWithProviders(<KeysScreen />);

    expect(screen.getByText("id_ed25519")).toBeTruthy();
    expect(screen.getByText("ed25519")).toBeTruthy(); // lowercased type pill
    expect(screen.getByText(FINGERPRINT)).toBeTruthy();
    // The empty state is not shown once a key is synced.
    expect(screen.queryByText("Nothing synced yet")).toBeNull();
  });

  it("copies the public key when the copy action is pressed", async () => {
    store.dispatch(vaultUnlocked({ hosts: [], keys: [KEY], version: 0 }));
    await renderWithProviders(<KeysScreen />);

    fireEvent.press(screen.getByTestId("keys-copy-k1"));
    expect(mockedSetString).toHaveBeenCalledWith(PUBLIC_KEY);
  });

  it("omits the fingerprint and copy action for a key without a public half", async () => {
    const noPub: VaultKeyMeta = { id: "k2", name: "legacy", type: "rsa", addedAt: "" };
    store.dispatch(vaultUnlocked({ hosts: [], keys: [noPub], version: 0 }));
    await renderWithProviders(<KeysScreen />);

    expect(screen.getByText("legacy")).toBeTruthy();
    expect(screen.queryByTestId("keys-copy-k2")).toBeNull();
  });
});
