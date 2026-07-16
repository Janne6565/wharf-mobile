import projectFixture from "@/crypto/__fixtures__/project-fixture.json";

jest.mock("@/api/wharf", () => ({
  getCurrentUser: jest.fn(),
  getVault: jest.fn(),
  updateVault: jest.fn(),
  updatePublicKey: jest.fn(),
}));
jest.mock("@/vault/vaultSession", () => ({
  getVaultSession: jest.fn(),
  updateVaultSessionPayload: jest.fn(),
}));
jest.mock("@/vault/storage", () => ({
  writeVaultBlob: jest.fn(),
  updateVaultMeta: jest.fn().mockResolvedValue(undefined),
}));
jest.mock("@/sync/engine", () => ({ runSync: jest.fn().mockResolvedValue(undefined) }));
jest.mock("@/auth/masterSecret", () => ({ getMasterPassword: jest.fn(() => "pw") }));
jest.mock("@/crypto", () => {
  const actual = jest.requireActual("@/crypto");
  return {
    ...actual,
    generateKeypair: jest.fn(),
    sealPayload: jest.fn(),
    openWithDek: jest.fn(),
    unlockWithPassword: jest.fn(),
  };
});

import { getCurrentUser, getVault, updatePublicKey, updateVault } from "@/api/wharf";
import type { UnlockedVault } from "@/crypto";
import { fromBase64, generateKeypair, openWithDek, sealPayload, toBase64 } from "@/crypto";
import { getVaultSession } from "@/vault/vaultSession";
import { ensureIdentity, withIdentity } from "./identity";

const enc = (s: string) => new TextEncoder().encode(s);
const PUB = projectFixture.publicKeyBase64;
const PRIV = projectFixture.privateKeyBase64;

const mocked = {
  getCurrentUser: getCurrentUser as jest.Mock,
  getVault: getVault as jest.Mock,
  updateVault: updateVault as jest.Mock,
  updatePublicKey: updatePublicKey as jest.Mock,
  getVaultSession: getVaultSession as jest.Mock,
  generateKeypair: generateKeypair as jest.Mock,
  sealPayload: sealPayload as jest.Mock,
  openWithDek: openWithDek as jest.Mock,
};

function session(payload: object): UnlockedVault {
  return {
    dek: new Uint8Array(32).fill(7),
    payload: enc(JSON.stringify(payload)),
    params: { iterations: 3, memoryKiB: 65536, parallelism: 4 },
    header: new Uint8Array(218),
  };
}

const DOC_NO_IDENTITY = { schema: 1, hosts: [{ id: "1", name: "a" }] };
const DOC_WITH_IDENTITY = {
  schema: 2,
  hosts: [{ id: "1", name: "a" }],
  identity: { x25519Pub: PUB, x25519Priv: PRIV, createdAt: "2026-07-16T00:00:00Z" },
};

function axios409(): Error {
  return Object.assign(new Error("conflict"), { isAxiosError: true, response: { status: 409 } });
}

beforeEach(() => {
  jest.clearAllMocks();
  mocked.sealPayload.mockResolvedValue(enc("sealed-blob"));
  mocked.generateKeypair.mockResolvedValue({
    publicKey: fromBase64(PUB),
    privateKey: fromBase64(PRIV),
  });
});

describe("withIdentity", () => {
  it("writes the identity and bumps schema to 2, preserving unknown fields", () => {
    const payload = enc(
      JSON.stringify({ schema: 1, hosts: [{ id: "1", password: "keep" }], custom: 42 }),
    );
    const out = JSON.parse(
      new TextDecoder().decode(withIdentity(payload, DOC_WITH_IDENTITY.identity)),
    );
    expect(out.schema).toBe(2);
    expect(out.identity.x25519Pub).toBe(PUB);
    expect(out.hosts[0].password).toBe("keep");
    expect(out.custom).toBe(42);
  });
});

describe("ensureIdentity", () => {
  it("case 1: vault has an identity, publishes it when the server lacks one", async () => {
    mocked.getVaultSession.mockReturnValue(session(DOC_WITH_IDENTITY));
    mocked.getCurrentUser.mockResolvedValue({ publicKey: null });

    const status = await ensureIdentity(0);

    expect(status.kind).toBe("ready");
    if (status.kind !== "ready") return;
    expect(status.keys.publicKey).toEqual(fromBase64(PUB));
    expect(mocked.updatePublicKey).toHaveBeenCalledWith({ publicKey: PUB, rotate: false });
    expect(mocked.updateVault).not.toHaveBeenCalled();
  });

  it("case 1: does not re-publish when the server already holds the key", async () => {
    mocked.getVaultSession.mockReturnValue(session(DOC_WITH_IDENTITY));
    mocked.getCurrentUser.mockResolvedValue({ publicKey: PUB });

    const status = await ensureIdentity(0);

    expect(status.kind).toBe("ready");
    expect(mocked.updatePublicKey).not.toHaveBeenCalled();
  });

  it("case 2: no identity but server has a key → needs-sync after a sync pass", async () => {
    mocked.getVaultSession.mockReturnValue(session(DOC_NO_IDENTITY));
    mocked.getCurrentUser.mockResolvedValue({ publicKey: "otherkey" });

    const status = await ensureIdentity(0);

    expect(status.kind).toBe("needs-sync");
    expect(jest.requireMock("@/sync/engine").runSync).toHaveBeenCalled();
    expect(mocked.generateKeypair).not.toHaveBeenCalled();
  });

  it("case 2: a sync that pulls the identity resolves to ready without minting a key", async () => {
    mocked.getVaultSession
      .mockReturnValueOnce(session(DOC_NO_IDENTITY))
      .mockReturnValue(session(DOC_WITH_IDENTITY));
    mocked.getCurrentUser.mockResolvedValue({ publicKey: "otherkey" });

    const status = await ensureIdentity(0);

    expect(status.kind).toBe("ready");
    expect(mocked.generateKeypair).not.toHaveBeenCalled();
  });

  it("case 3: neither side has a key → generates, versioned-PUTs and publishes", async () => {
    mocked.getVaultSession.mockReturnValue(session(DOC_NO_IDENTITY));
    mocked.getCurrentUser.mockResolvedValue({ publicKey: null });
    mocked.updateVault.mockResolvedValue({ version: 8 });

    const status = await ensureIdentity(3);

    expect(status.kind).toBe("ready");
    expect(mocked.generateKeypair).toHaveBeenCalled();
    expect(mocked.updateVault).toHaveBeenCalledWith({
      vault: toBase64(enc("sealed-blob")),
      expectedVersion: 3,
    });
    expect(mocked.updatePublicKey).toHaveBeenCalledWith({ publicKey: PUB, rotate: false });
  });

  it("case 3: a 409 adopts the remote payload, re-applies the identity and retries once", async () => {
    mocked.getVaultSession.mockReturnValue(session(DOC_NO_IDENTITY));
    mocked.getCurrentUser.mockResolvedValue({ publicKey: null });
    mocked.updateVault.mockRejectedValueOnce(axios409()).mockResolvedValueOnce({ version: 10 });
    mocked.getVault.mockResolvedValue({ vault: toBase64(enc("remote-blob")), version: 9 });
    mocked.openWithDek.mockResolvedValue(enc(JSON.stringify(DOC_NO_IDENTITY)));

    const status = await ensureIdentity(3);

    expect(status.kind).toBe("ready");
    expect(mocked.updateVault).toHaveBeenCalledTimes(2);
    // The retry uses the fresh remote version as the expected version.
    expect(mocked.updateVault).toHaveBeenLastCalledWith({
      vault: toBase64(enc("sealed-blob")),
      expectedVersion: 9,
    });
    expect(mocked.openWithDek).toHaveBeenCalled();
  });
});
