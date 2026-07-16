import { reconcileVaultAccount } from "./account";

jest.mock("@/vault/storage", () => ({
  readVaultMeta: jest.fn(),
  clearVaultStorage: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/vault/biometric", () => ({
  clearBiometricDek: jest.fn().mockResolvedValue(undefined),
}));

import { clearBiometricDek } from "@/vault/biometric";
import { clearVaultStorage, readVaultMeta } from "@/vault/storage";

const mockedReadMeta = readVaultMeta as jest.MockedFunction<typeof readVaultMeta>;
const mockedClearStorage = clearVaultStorage as jest.MockedFunction<typeof clearVaultStorage>;
const mockedClearDek = clearBiometricDek as jest.MockedFunction<typeof clearBiometricDek>;

const meta = (userId?: string) => ({ version: 1, storedAt: "", ...(userId ? { userId } : {}) });

describe("reconcileVaultAccount", () => {
  beforeEach(() => jest.clearAllMocks());

  it("wipes the cached vault when a different account signs in", async () => {
    mockedReadMeta.mockResolvedValue(meta("user-A"));
    const wiped = await reconcileVaultAccount("user-B");
    expect(wiped).toBe(true);
    expect(mockedClearStorage).toHaveBeenCalledTimes(1);
    expect(mockedClearDek).toHaveBeenCalledTimes(1);
  });

  it("keeps the vault when the same account signs in", async () => {
    mockedReadMeta.mockResolvedValue(meta("user-A"));
    expect(await reconcileVaultAccount("user-A")).toBe(false);
    expect(mockedClearStorage).not.toHaveBeenCalled();
  });

  it("does nothing on a fresh device with no recorded account", async () => {
    mockedReadMeta.mockResolvedValue(meta());
    expect(await reconcileVaultAccount("user-A")).toBe(false);
    mockedReadMeta.mockResolvedValue(null);
    expect(await reconcileVaultAccount("user-A")).toBe(false);
    expect(mockedClearStorage).not.toHaveBeenCalled();
  });
});
