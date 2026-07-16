// The CRUD → reducer → scheduled-push flow. sealPayload, the blob file write, and
// the debounced push are mocked so the test asserts the observable effects: the
// derived vault slice updates and a push is scheduled after each mutation.

jest.mock("@/sync/engine", () => ({ scheduleSyncPush: jest.fn() }));
jest.mock("@/vault/storage", () => ({ writeVaultBlob: jest.fn() }));
jest.mock("@/crypto", () => {
  const actual = jest.requireActual("@/crypto");
  return { ...actual, sealPayload: jest.fn().mockResolvedValue(new Uint8Array([9, 9, 9])) };
});

import { initialVaultPayload } from "@/crypto";
import { store } from "@/store";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import { scheduleSyncPush } from "@/sync/engine";
import { writeVaultBlob } from "@/vault/storage";
import { addHost, deleteHost, editHost } from "./hostMutations";
import type { HostInput } from "./mutate";
import { setVaultSession } from "./vaultSession";

const mockedSchedule = scheduleSyncPush as jest.MockedFunction<typeof scheduleSyncPush>;
const mockedWrite = writeVaultBlob as jest.MockedFunction<typeof writeVaultBlob>;

const input = (over: Partial<HostInput> = {}): HostInput => ({
  name: "web",
  user: "deploy",
  addr: "web.example.com",
  port: 2222,
  tags: [],
  ...over,
});

function primeSession() {
  setVaultSession({
    dek: new Uint8Array(32),
    payload: initialVaultPayload(),
    params: { iterations: 1, memoryKiB: 8, parallelism: 1 },
    header: new Uint8Array(218),
  });
}

describe("host mutations flow", () => {
  beforeEach(() => {
    store.dispatch(vaultLocked());
    store.dispatch(vaultUnlocked({ hosts: [], version: 3 }));
    primeSession();
    jest.clearAllMocks();
  });

  it("addHost updates the vault slice, writes the blob and schedules a push", async () => {
    const id = await addHost(input({ tags: ["prod"] }));
    const hosts = store.getState().vault.hosts;
    expect(hosts).toHaveLength(1);
    expect(hosts[0]).toMatchObject({
      id,
      name: "web",
      addr: "web.example.com",
      port: 2222,
      tags: ["prod"],
    });
    expect(store.getState().vault.version).toBe(3); // unchanged until the push lands
    expect(mockedWrite).toHaveBeenCalledTimes(1);
    expect(mockedSchedule).toHaveBeenCalledTimes(1);
  });

  it("editHost renames the host in the slice and schedules another push", async () => {
    const id = await addHost(input());
    jest.clearAllMocks();
    await editHost(id, input({ name: "web-2", port: 22 }));
    const host = store.getState().vault.hosts.find((h) => h.id === id);
    expect(host?.name).toBe("web-2");
    expect(host?.port).toBe(22);
    expect(mockedSchedule).toHaveBeenCalledTimes(1);
  });

  it("deleteHost removes the host and schedules a push", async () => {
    const id = await addHost(input());
    jest.clearAllMocks();
    await deleteHost(id);
    expect(store.getState().vault.hosts).toHaveLength(0);
    expect(mockedSchedule).toHaveBeenCalledTimes(1);
  });

  it("throws when the vault is locked (no session)", async () => {
    store.dispatch(vaultLocked());
    setVaultSession(undefined as never);
    await expect(addHost(input())).rejects.toThrow();
  });
});
