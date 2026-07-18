import { fromBase64 } from "@/crypto";
import type { IdentityStatus } from "@/vault/identity";
import { HostMutationError } from "@/vault/mutate";
import {
  moveHostToProject,
  type ProjectWriteDeps,
  ProjectWriteError,
  setProjectHostPassword,
} from "./projectVaultWrite";

const enc = (s: string) => new TextEncoder().encode(s);
const decodeVault = (base64: string) => JSON.parse(new TextDecoder().decode(fromBase64(base64)));

// A personal vault holding one password-auth host, to prove the RAW host (password
// and all) is what lands in the project — not the stripped Redux view.
const PERSONAL = enc(
  JSON.stringify({
    schema: 2,
    hosts: [
      {
        id: "h1",
        name: "web",
        user: "deploy",
        addr: "web.io",
        port: 22,
        authMethod: "password",
        password: "s3cret",
        source: "manual",
      },
    ],
  }),
);

// The decrypted project document openProject yields — an empty TUI project.
const PROJECT_DOC = enc(JSON.stringify({ schema: 1, hosts: null }));

// A project document already holding one key-auth host, to prove a remembered
// password lands on it (with authMethod flipped) while its other fields survive.
const PROJECT_WITH_HOST = enc(
  JSON.stringify({
    schema: 1,
    hosts: [
      {
        id: "h1",
        name: "web",
        user: "deploy",
        addr: "web.io",
        port: 2222,
        authMethod: "key",
        source: "manual",
      },
    ],
  }),
);

const READY: IdentityStatus = {
  kind: "ready",
  keys: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) },
};

const WRAPPED = enc("wrapped-dek");
const DEK = enc("dek");
const BLOB = enc("project-blob");

function axios409() {
  return Object.assign(new Error("conflict"), {
    isAxiosError: true,
    response: { status: 409 },
  });
}

interface FakeBits {
  deps: ProjectWriteDeps;
  order: string[];
  update: jest.Mock;
  del: jest.Mock;
  fetchVault: jest.Mock;
  resync: jest.Mock;
}

function makeDeps(over: Partial<ProjectWriteDeps> = {}, projectDoc = PROJECT_DOC): FakeBits {
  const order: string[] = [];
  const fetchVault = jest.fn(async () => ({ blob: BLOB, version: 5, wrappedDek: WRAPPED }));
  const update = jest.fn(async () => {
    order.push("put");
    return { version: 6 };
  });
  const del = jest.fn(async () => {
    order.push("delete");
  });
  const resync = jest.fn(async () => undefined);
  const deps: ProjectWriteDeps = {
    getVaultSession: () => ({ payload: PERSONAL }),
    ensureIdentity: async () => READY,
    getVaultVersion: () => 3,
    fetchVault,
    updateProjectVault: update,
    openDek: async () => DEK,
    openProject: async () => projectDoc,
    // Identity seal so the captured vault base64 decodes straight back to the doc.
    sealProject: async (_dek, payload) => payload,
    deleteHost: del,
    runProjectsSync: resync,
    ...over,
  };
  return { deps, order, update, del, fetchVault, resync };
}

describe("moveHostToProject", () => {
  it("writes the project before deleting the personal host, moving the raw password", async () => {
    const fake = makeDeps();
    await moveHostToProject("h1", "p1", fake.deps);

    // The project PUT lands before the personal removal — a failure never loses it.
    expect(fake.order).toEqual(["put", "delete"]);
    expect(fake.resync).toHaveBeenCalledTimes(1);

    // The written vault, decoded, carries the moved host WITH its stored password.
    const written = decodeVault(fake.update.mock.calls[0][1].vault);
    expect(written.hosts).toHaveLength(1);
    expect(written.hosts[0]).toMatchObject({ id: "h1", name: "web", password: "s3cret" });
    expect(fake.update.mock.calls[0][1].expectedVersion).toBe(5);
  });

  it("retries on a 409 and succeeds on the refetched version", async () => {
    const update = jest
      .fn()
      .mockRejectedValueOnce(axios409())
      .mockResolvedValueOnce({ version: 7 });
    const fake = makeDeps({ updateProjectVault: update });
    await moveHostToProject("h1", "p1", fake.deps);

    expect(fake.fetchVault).toHaveBeenCalledTimes(2);
    expect(update).toHaveBeenCalledTimes(2);
    expect(fake.del).toHaveBeenCalledTimes(1);
  });

  it("aborts on a duplicate name without deleting the personal host", async () => {
    // The project already holds a host named "web": addRawHostToPayload throws.
    const dup = enc(JSON.stringify({ schema: 1, hosts: [{ id: "x", name: "web" }] }));
    const fake = makeDeps({}, dup);

    await expect(moveHostToProject("h1", "p1", fake.deps)).rejects.toThrow(
      expect.objectContaining({ code: "name-duplicate" }),
    );
    await expect(moveHostToProject("h1", "p1", fake.deps)).rejects.toBeInstanceOf(
      HostMutationError,
    );
    expect(fake.update).not.toHaveBeenCalled();
    expect(fake.del).not.toHaveBeenCalled();
  });

  it("reports awaiting-key when the wrapped DEK will not open", async () => {
    const fake = makeDeps({
      openDek: async () => {
        throw new Error("cannot open");
      },
    });

    await expect(moveHostToProject("h1", "p1", fake.deps)).rejects.toThrow(
      expect.objectContaining({ code: "awaiting-key" }),
    );
    await expect(moveHostToProject("h1", "p1", fake.deps)).rejects.toBeInstanceOf(
      ProjectWriteError,
    );
    expect(fake.del).not.toHaveBeenCalled();
  });

  it("reports locked when the vault session is gone", async () => {
    const fake = makeDeps({ getVaultSession: () => null });
    await expect(moveHostToProject("h1", "p1", fake.deps)).rejects.toThrow(
      expect.objectContaining({ code: "locked" }),
    );
  });

  it("reports needs-sync when the identity is not ready", async () => {
    const fake = makeDeps({ ensureIdentity: async () => ({ kind: "needs-sync" }) });
    await expect(moveHostToProject("h1", "p1", fake.deps)).rejects.toThrow(
      expect.objectContaining({ code: "needs-sync" }),
    );
  });
});

describe("setProjectHostPassword", () => {
  it("writes the password + password authMethod onto the host, preserving other fields", async () => {
    const fake = makeDeps({}, PROJECT_WITH_HOST);
    await setProjectHostPassword("p1", "h1", "s3cret", fake.deps);

    const written = decodeVault(fake.update.mock.calls[0][1].vault);
    expect(written.hosts).toHaveLength(1);
    expect(written.hosts[0]).toMatchObject({
      id: "h1",
      name: "web",
      user: "deploy",
      addr: "web.io",
      port: 2222,
      source: "manual",
      authMethod: "password",
      password: "s3cret",
    });
    expect(fake.update.mock.calls[0][1].expectedVersion).toBe(5);
  });

  it("re-syncs projects after the write so the cache picks up the new password", async () => {
    const fake = makeDeps({}, PROJECT_WITH_HOST);
    await setProjectHostPassword("p1", "h1", "s3cret", fake.deps);
    expect(fake.resync).toHaveBeenCalledTimes(1);
  });

  it("propagates not-found when the host was removed remotely meanwhile", async () => {
    // The project no longer holds h1: setHostPasswordInPayload throws not-found.
    const fake = makeDeps({}, PROJECT_DOC);
    await expect(setProjectHostPassword("p1", "h1", "s3cret", fake.deps)).rejects.toThrow(
      expect.objectContaining({ code: "not-found" }),
    );
    await expect(setProjectHostPassword("p1", "h1", "s3cret", fake.deps)).rejects.toBeInstanceOf(
      HostMutationError,
    );
    expect(fake.update).not.toHaveBeenCalled();
  });

  it("reports locked when the vault session is gone", async () => {
    const fake = makeDeps({ getVaultSession: () => null });
    await expect(setProjectHostPassword("p1", "h1", "s3cret", fake.deps)).rejects.toThrow(
      expect.objectContaining({ code: "locked" }),
    );
  });

  it("reports needs-sync when the identity is not ready", async () => {
    const fake = makeDeps({ ensureIdentity: async () => ({ kind: "needs-sync" }) });
    await expect(setProjectHostPassword("p1", "h1", "s3cret", fake.deps)).rejects.toThrow(
      expect.objectContaining({ code: "needs-sync" }),
    );
  });
});
