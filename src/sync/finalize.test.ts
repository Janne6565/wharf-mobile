import { fromBase64, openDek, sealDek, toBase64, WRAPPED_DEK_LEN } from "@/crypto";
import projectFixture from "@/crypto/__fixtures__/project-fixture.json";
import { runFinalizePass } from "./finalize";
import type {
  FinalizeDeps,
  FinalizeTarget,
  PendingMember,
  RemoteProjectVault,
} from "./projectTypes";

// Golden keys from the Go-generated project fixture. `wrappedDekBase64` is the
// project DEK sealed to `publicKeyBase64`, openable by `privateKeyBase64` — so a
// realistic finalize deps can open the caller's DEK with real crypto and re-seal
// it to a pending member (here, the same fixture key acting as the member).
const DEK = fromBase64(projectFixture.dekBase64);
const CALLER_PUB = fromBase64(projectFixture.publicKeyBase64);
const CALLER_PRIV = fromBase64(projectFixture.privateKeyBase64);
const WRAPPED = fromBase64(projectFixture.wrappedDekBase64);
const VERSION = 5;

// A plain object that axios's isAxiosError recognises (checks `isAxiosError`),
// so getHttpStatus reads the status the way it would from a real failed request.
function httpError(status: number): unknown {
  return { isAxiosError: true, response: { status } };
}

interface SubmitCall {
  id: string;
  userId: string;
  wrappedDek: Uint8Array;
  vaultVersion: number;
}

interface FakeOpts {
  vault?: RemoteProjectVault;
  dek?: Uint8Array | null;
  pending?: PendingMember[];
  submit?: (call: SubmitCall) => void; // throw to simulate a failure
}

interface Fake {
  deps: FinalizeDeps;
  fetchVault: jest.Mock;
  getPendingKeys: jest.Mock;
  submitCalls: SubmitCall[];
}

function makeFake(opts: FakeOpts = {}): Fake {
  const submitCalls: SubmitCall[] = [];
  const fetchVault = jest.fn(
    async (): Promise<RemoteProjectVault> =>
      opts.vault ?? { status: "present", blob: null, version: VERSION, wrappedDek: WRAPPED },
  );
  const getPendingKeys = jest.fn(
    async (): Promise<readonly PendingMember[]> =>
      opts.pending ?? [{ userId: "u-sam", publicKey: CALLER_PUB }],
  );
  const deps: FinalizeDeps = {
    fetchVault,
    // Real unwrap: closes over the fixture keypair, mirroring makeFinalizeDeps.
    openDek: async (wrapped) => {
      if (opts.dek !== undefined) return opts.dek;
      try {
        return await openDek(wrapped, CALLER_PUB, CALLER_PRIV);
      } catch {
        return null;
      }
    },
    getPendingKeys,
    sealDek: (dek, pub) => sealDek(dek, pub), // real seal → 80-byte payload
    submitMemberKey: async (id, userId, wrappedDek, vaultVersion) => {
      const call = { id, userId, wrappedDek, vaultVersion };
      submitCalls.push(call);
      opts.submit?.(call);
    },
  };
  return { deps, fetchVault, getPendingKeys, submitCalls };
}

function admin(id = "p1"): FinalizeTarget {
  return { id, role: "ADMIN" };
}

describe("runFinalizePass", () => {
  it("seals the DEK to a pending member and submits an 80-byte payload at the vault version", async () => {
    const fake = makeFake();
    await runFinalizePass(fake.deps, [admin()]);

    expect(fake.submitCalls).toHaveLength(1);
    const call = fake.submitCalls[0];
    expect(call.id).toBe("p1");
    expect(call.userId).toBe("u-sam");
    expect(call.vaultVersion).toBe(VERSION);
    // Every wrapped DEK is exactly WRAPPED_DEK_LEN (80) bytes…
    expect(call.wrappedDek).toHaveLength(WRAPPED_DEK_LEN);
    // …and opening it with the member's private key yields the original DEK.
    const reopened = await openDek(call.wrappedDek, CALLER_PUB, CALLER_PRIV);
    expect(toBase64(reopened)).toBe(toBase64(DEK));
  });

  it("skips a stale 409 silently and does not throw", async () => {
    const fake = makeFake({
      submit: () => {
        throw httpError(409);
      },
    });
    await expect(runFinalizePass(fake.deps, [admin()])).resolves.toBeUndefined();
    expect(fake.submitCalls).toHaveLength(1); // attempted once, error swallowed
  });

  it("isolates a per-member failure so remaining members still finalize", async () => {
    const fake = makeFake({
      pending: [
        { userId: "u-fail", publicKey: CALLER_PUB },
        { userId: "u-ok", publicKey: CALLER_PUB },
      ],
      submit: (call) => {
        if (call.userId === "u-fail") throw httpError(500);
      },
    });
    await runFinalizePass(fake.deps, [admin()]);

    expect(fake.submitCalls.map((c) => c.userId)).toEqual(["u-fail", "u-ok"]);
  });

  it("skips non-admin projects without fetching their vault", async () => {
    const fake = makeFake();
    await runFinalizePass(fake.deps, [{ id: "p1", role: "MEMBER" }]);

    expect(fake.fetchVault).not.toHaveBeenCalled();
    expect(fake.submitCalls).toHaveLength(0);
  });

  it("skips a project whose DEK does not open (not keyed yet)", async () => {
    const fake = makeFake({ dek: null });
    await runFinalizePass(fake.deps, [admin()]);

    expect(fake.getPendingKeys).not.toHaveBeenCalled();
    expect(fake.submitCalls).toHaveLength(0);
  });

  it("skips a project with no wrapped DEK for us", async () => {
    const fake = makeFake({
      vault: { status: "present", blob: null, version: VERSION, wrappedDek: null },
    });
    await runFinalizePass(fake.deps, [admin()]);

    expect(fake.getPendingKeys).not.toHaveBeenCalled();
    expect(fake.submitCalls).toHaveLength(0);
  });

  it("skips a project whose vault 404s (membership vanished mid-pass)", async () => {
    const fake = makeFake({ vault: { status: "not-found" } });
    await runFinalizePass(fake.deps, [admin()]);

    expect(fake.getPendingKeys).not.toHaveBeenCalled();
    expect(fake.submitCalls).toHaveLength(0);
  });

  it("isolates a project-level failure so other projects still finalize", async () => {
    const fake = makeFake();
    // First project's fetchVault throws; second succeeds.
    fake.fetchVault.mockRejectedValueOnce(new Error("network")).mockResolvedValueOnce({
      status: "present",
      blob: null,
      version: VERSION,
      wrappedDek: WRAPPED,
    });
    await runFinalizePass(fake.deps, [admin("p1"), admin("p2")]);

    expect(fake.submitCalls.map((c) => c.id)).toEqual(["p2"]);
  });
});
