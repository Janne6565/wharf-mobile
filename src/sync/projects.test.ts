import type { ProjectSummary } from "@/api/generated/model";
import { toBase64 } from "@/crypto";
import projectFixture from "@/crypto/__fixtures__/project-fixture.json";
import type { ProjectMetaEntry } from "@/vault/storage";
import { fingerprint } from "./fingerprint";
import { ProjectSyncEngine } from "./projects";
import type { InviteView, ProjectSyncDeps, RemoteProjectVault } from "./projectTypes";

const enc = (s: string) => new TextEncoder().encode(s);

// The fixture's decrypted project document — the golden payload a real WHARFP open
// would yield (one host, prod-web-01). Used to prove the read path end-to-end
// without invoking crypto (the engine consumes an already-opened payload).
const FIXTURE_PAYLOAD = enc(projectFixture.payloadUtf8);
const WRAPPED = enc("wrapped-dek-bytes");
const DEK = enc("dek-bytes");
const BLOB = enc("project-blob");

function summary(over: Partial<ProjectSummary> = {}): ProjectSummary {
  return {
    id: "p1",
    name: "Atlas Platform",
    description: "Core API + data plane",
    role: "MEMBER",
    memberCount: 3,
    pendingInviteCount: 1,
    vaultVersion: 5,
    awaitingKey: false,
    ...over,
  };
}

interface FakeOpts {
  list?: ProjectSummary[] | (() => never);
  invites?: InviteView[];
  meta?: Record<string, ProjectMetaEntry>;
  vault?: RemoteProjectVault;
  dek?: Uint8Array | null;
  payload?: Uint8Array | null;
  cached?: Uint8Array | null;
}

interface Fake {
  deps: ProjectSyncDeps;
  cache: jest.Mock;
  drop: jest.Mock;
  fetchVault: jest.Mock;
}

function makeFake(opts: FakeOpts): Fake {
  const cache = jest.fn(async () => undefined);
  const drop = jest.fn(async () => undefined);
  const fetchVault = jest.fn(
    async (): Promise<RemoteProjectVault> =>
      opts.vault ?? { status: "present", blob: BLOB, version: 5, wrappedDek: WRAPPED },
  );
  const deps: ProjectSyncDeps = {
    listProjects: async () => {
      if (typeof opts.list === "function") {
        opts.list();
        throw new Error("unreachable");
      }
      return opts.list ?? [summary()];
    },
    fetchInvites: async () => opts.invites ?? [],
    loadMeta: async () => opts.meta ?? {},
    fetchVault,
    openDek: async () => (opts.dek === undefined ? DEK : opts.dek),
    openBlob: async () => (opts.payload === undefined ? FIXTURE_PAYLOAD : opts.payload),
    cacheProject: cache,
    dropProject: drop,
    loadCached: async () => (opts.cached === undefined ? FIXTURE_PAYLOAD : opts.cached),
  };
  return { deps, cache, drop, fetchVault };
}

describe("ProjectSyncEngine", () => {
  it("unwraps, opens, caches and exposes a keyed project's hosts", async () => {
    const fake = makeFake({});
    const outcome = await new ProjectSyncEngine(fake.deps).sync();

    expect(outcome.kind).toBe("ok");
    if (outcome.kind !== "ok") return;
    expect(outcome.views).toHaveLength(1);
    const view = outcome.views[0];
    expect(view.awaiting).toBe(false);
    expect(view.hosts.map((h) => h.name)).toEqual(["prod-web-01"]);
    expect(view.memberCount).toBe(3);
    expect(view.pendingInviteCount).toBe(1);

    // Cached with the pulled version + fingerprint + the wrapped DEK (base64).
    expect(fake.cache).toHaveBeenCalledWith(
      "p1",
      {
        name: "Atlas Platform",
        role: "MEMBER",
        version: 5,
        fingerprint: fingerprint(FIXTURE_PAYLOAD),
        wrappedDek: toBase64(WRAPPED),
      } satisfies ProjectMetaEntry,
      BLOB,
    );
  });

  it("strips a project host's stored password from the read-only view", async () => {
    // The fixture payload carries a `password` field on its host; it must not leak.
    const fake = makeFake({});
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(outcome.views[0].hosts[0]).not.toHaveProperty("password");
  });

  it("tolerates hosts:null (TUI empty project) as an empty host list", async () => {
    const fake = makeFake({ payload: enc('{"schema":1,"hosts":null}') });
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(outcome.views[0].awaiting).toBe(false);
    expect(outcome.views[0].hosts).toEqual([]);
  });

  it.each([
    ["awaitingKey summary", { list: [summary({ awaitingKey: true })] }],
    [
      "null wrapped DEK",
      {
        vault: {
          status: "present",
          blob: BLOB,
          version: 5,
          wrappedDek: null,
        } as RemoteProjectVault,
      },
    ],
    ["DEK that will not open", { dek: null }],
    ["blob that will not open", { payload: null }],
  ])("marks a project awaiting when %s", async (_label, over) => {
    const fake = makeFake(over as FakeOpts);
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(outcome.views[0].awaiting).toBe(true);
    expect(outcome.views[0].hosts).toEqual([]);
    expect(fake.cache).not.toHaveBeenCalled();
  });

  it("does not fetch the vault for an awaiting-key summary", async () => {
    const fake = makeFake({ list: [summary({ awaitingKey: true })] });
    await new ProjectSyncEngine(fake.deps).sync();
    expect(fake.fetchVault).not.toHaveBeenCalled();
  });

  it("drops a cached project whose membership vanished", async () => {
    const meta: Record<string, ProjectMetaEntry> = {
      gone: { name: "Gone", role: "MEMBER", version: 1, fingerprint: "x", wrappedDek: "y" },
    };
    const fake = makeFake({ list: [summary()], meta });
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(fake.drop).toHaveBeenCalledWith("gone");
    expect(outcome.removed).toContain("gone");
    expect(outcome.views.map((v) => v.id)).toEqual(["p1"]);
  });

  it("drops a project whose vault fetch 404s and omits it from the views", async () => {
    const fake = makeFake({ vault: { status: "not-found" } });
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(fake.drop).toHaveBeenCalledWith("p1");
    expect(outcome.removed).toContain("p1");
    expect(outcome.views).toEqual([]);
  });

  it("returns the caller's pending invites", async () => {
    const invites: InviteView[] = [
      { id: "i1", projectId: "p9", projectName: "Nebula", invitedByEmail: "mara@acme.io" },
    ];
    const fake = makeFake({ invites });
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    if (outcome.kind !== "ok") throw new Error("expected ok");
    expect(outcome.invites).toEqual(invites);
  });

  it("falls back to the on-disk cache when the projects list is offline", async () => {
    const meta: Record<string, ProjectMetaEntry> = {
      p1: { name: "Atlas Platform", role: "OWNER", version: 4, fingerprint: "f", wrappedDek: "w" },
    };
    const fake = makeFake({
      list: () => {
        throw new Error("offline");
      },
      meta,
    });
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    expect(outcome.kind).toBe("offline");
    if (outcome.kind !== "offline") return;
    expect(outcome.views).toHaveLength(1);
    expect(outcome.views[0].role).toBe("OWNER");
    expect(outcome.views[0].hosts.map((h) => h.name)).toEqual(["prod-web-01"]);
  });

  it("marks a cached project awaiting when its blob no longer opens offline", async () => {
    const meta: Record<string, ProjectMetaEntry> = {
      p1: { name: "Atlas Platform", role: "MEMBER", version: 4, fingerprint: "f", wrappedDek: "w" },
    };
    const fake = makeFake({
      list: () => {
        throw new Error("offline");
      },
      meta,
      cached: null,
    });
    const outcome = await new ProjectSyncEngine(fake.deps).sync();
    if (outcome.kind !== "offline") throw new Error("expected offline");
    expect(outcome.views[0].awaiting).toBe(true);
  });
});
