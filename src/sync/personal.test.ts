import { fingerprint } from "./fingerprint";
import { PersonalSyncEngine } from "./personal";
import type { PersonalSyncDeps, PersonalSyncState, RemoteVault } from "./types";
import { VaultConflictError } from "./types";

const enc = (s: string) => new TextEncoder().encode(s);

const EMPTY = enc('{"schema":1,"hosts":[]}');
const LOCAL_A = enc('{"schema":1,"hosts":[{"id":"1","name":"a"}]}');
const REMOTE_B = enc('{"schema":1,"hosts":[{"id":"2","name":"b"}]}');

// A configurable fake of the side-effecting deps. fetchRemote can be swapped mid
// test (for the 409 re-pass); commit mutates the in-memory baseline like the real
// meta file; adopt just records the adopted payload.
interface Fake {
  deps: PersonalSyncDeps;
  state: PersonalSyncState;
  remoteQueue: (RemoteVault | (() => never))[];
  fetchCalls: number;
  push: jest.Mock;
  adopt: jest.Mock;
  openResult: Uint8Array | "needs-password";
}

function makeFake(opts: {
  payload: Uint8Array;
  state: PersonalSyncState;
  remotes: (RemoteVault | (() => never))[];
  pushImpl?: () => number;
  openResult?: Uint8Array | "needs-password";
}): Fake {
  const fake: Fake = {
    state: { ...opts.state },
    remoteQueue: [...opts.remotes],
    fetchCalls: 0,
    push: jest.fn(opts.pushImpl ?? (() => opts.state.version + 1)),
    adopt: jest.fn(async () => undefined),
    openResult: opts.openResult ?? REMOTE_B,
    deps: undefined as unknown as PersonalSyncDeps,
  };
  fake.deps = {
    currentPayload: () => opts.payload,
    loadState: async () => fake.state,
    fetchRemote: async () => {
      fake.fetchCalls += 1;
      const next = fake.remoteQueue.shift();
      if (typeof next === "function") {
        next();
      }
      return next as RemoteVault;
    },
    pushRemote: async (expected: number) => fake.push(expected) as number,
    openRemote: async () => fake.openResult,
    adopt: async (payload, version) => {
      fake.adopt(payload, version);
      fake.state = { version, fingerprint: fingerprint(payload) };
    },
    commit: async (version, fp) => {
      fake.state = { version, fingerprint: fp };
    },
  };
  return fake;
}

const present = (
  blob: Uint8Array,
  version: number,
  updatedAt: string | null = null,
): RemoteVault => ({
  status: "present",
  blob,
  version,
  updatedAt,
});

describe("PersonalSyncEngine — 2×2 state machine", () => {
  it("no/no: in sync when nothing changed", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(LOCAL_A) },
      remotes: [present(LOCAL_A, 5)],
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "in-sync", version: 5 });
    expect(fake.push).not.toHaveBeenCalled();
    expect(fake.adopt).not.toHaveBeenCalled();
  });

  it("yes/no: pushes local changes and commits the new version", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(EMPTY) },
      remotes: [present(EMPTY, 5)],
      pushImpl: () => 6,
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "pushed", version: 6 });
    expect(fake.push).toHaveBeenCalledWith(5);
    expect(fake.state).toEqual({ version: 6, fingerprint: fingerprint(LOCAL_A) });
  });

  it("no/yes: fast-forward pull adopts the remote payload", async () => {
    const fake = makeFake({
      payload: EMPTY,
      state: { version: 5, fingerprint: fingerprint(EMPTY) },
      remotes: [present(REMOTE_B, 6)],
      openResult: REMOTE_B,
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "adopted", version: 6 });
    expect(fake.adopt).toHaveBeenCalledWith(REMOTE_B, 6);
  });

  it("remote moved but identical content: just commits agreement", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(LOCAL_A) },
      remotes: [present(LOCAL_A, 7)],
      openResult: LOCAL_A,
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "in-sync", version: 7 });
    expect(fake.adopt).not.toHaveBeenCalled();
    expect(fake.state.version).toBe(7);
  });

  it("yes/yes both non-empty: surfaces a conflict with host counts", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(EMPTY) },
      remotes: [present(REMOTE_B, 6, "2026-07-16T10:00:00Z")],
      openResult: REMOTE_B,
    });
    const engine = new PersonalSyncEngine(fake.deps);
    const outcome = await engine.sync();
    expect(outcome).toEqual({
      kind: "conflict",
      conflict: {
        localHosts: 1,
        remoteHosts: 1,
        remoteVersion: 6,
        remoteUpdatedAt: "2026-07-16T10:00:00Z",
      },
    });
    expect(engine.hasPending()).toBe(true);
  });

  it("yes/yes zero local hosts: auto-adopts the non-empty remote", async () => {
    const fake = makeFake({
      payload: EMPTY,
      state: { version: 5, fingerprint: fingerprint(enc('{"schema":1,"hosts":[],"x":1}')) },
      remotes: [present(REMOTE_B, 6)],
      openResult: REMOTE_B,
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "adopted", version: 6 });
    expect(fake.adopt).toHaveBeenCalledWith(REMOTE_B, 6);
  });

  it("yes/yes zero remote hosts: auto-pushes the non-empty local", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: {
        version: 5,
        fingerprint: fingerprint(enc('{"schema":1,"hosts":[{"id":"1","name":"a"},{}]}')),
      },
      remotes: [present(EMPTY, 6)],
      openResult: EMPTY,
      pushImpl: () => 7,
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "pushed", version: 7 });
    expect(fake.push).toHaveBeenCalledWith(6);
  });

  it("409 on push triggers a single re-pass", async () => {
    let pushes = 0;
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(EMPTY) },
      // First fetch: remote at v5 (no move) → push. Push 409s. Re-pass fetch:
      // remote moved to v6 with OUR content → same fingerprint → commit.
      remotes: [present(EMPTY, 5), present(LOCAL_A, 6)],
      openResult: LOCAL_A,
      pushImpl: () => {
        pushes += 1;
        throw new VaultConflictError();
      },
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "in-sync", version: 6 });
    expect(pushes).toBe(1);
    expect(fake.fetchCalls).toBe(2);
  });

  it("reports needs-password when a moved remote cannot be opened", async () => {
    const fake = makeFake({
      payload: EMPTY,
      state: { version: 5, fingerprint: fingerprint(EMPTY) },
      remotes: [present(REMOTE_B, 6)],
      openResult: "needs-password",
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "needs-password" });
  });

  it("maps a fetch failure to offline", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(LOCAL_A) },
      remotes: [
        () => {
          throw new Error("network down");
        },
      ],
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "offline" });
  });

  it("absent remote vault is a no-op (this backend cannot create via PUT)", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 3, fingerprint: fingerprint(EMPTY) },
      remotes: [{ status: "absent" }],
    });
    const outcome = await new PersonalSyncEngine(fake.deps).sync();
    expect(outcome).toEqual({ kind: "in-sync", version: 3 });
    expect(fake.push).not.toHaveBeenCalled();
  });
});

describe("PersonalSyncEngine — conflict resolution", () => {
  async function toConflict() {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(EMPTY) },
      remotes: [present(REMOTE_B, 6)],
      openResult: REMOTE_B,
      pushImpl: () => 7,
    });
    const engine = new PersonalSyncEngine(fake.deps);
    await engine.sync();
    return { fake, engine };
  }

  it("keep-local pushes the local vault over the remote", async () => {
    const { fake, engine } = await toConflict();
    const outcome = await engine.resolve(true);
    expect(outcome).toEqual({ kind: "pushed", version: 7 });
    expect(fake.push).toHaveBeenCalledWith(6);
    expect(engine.hasPending()).toBe(false);
  });

  it("take-remote adopts the stashed remote payload without refetching", async () => {
    const { fake, engine } = await toConflict();
    fake.fetchCalls = 0;
    const outcome = await engine.resolve(false);
    expect(outcome).toEqual({ kind: "adopted", version: 6 });
    expect(fake.adopt).toHaveBeenCalledWith(REMOTE_B, 6);
    expect(fake.fetchCalls).toBe(0);
    expect(engine.hasPending()).toBe(false);
  });

  it("resolve with no pending conflict re-syncs from scratch", async () => {
    const fake = makeFake({
      payload: LOCAL_A,
      state: { version: 5, fingerprint: fingerprint(LOCAL_A) },
      remotes: [present(LOCAL_A, 5)],
    });
    const outcome = await new PersonalSyncEngine(fake.deps).resolve(true);
    expect(outcome).toEqual({ kind: "in-sync", version: 5 });
  });
});
