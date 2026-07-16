// The personal-vault sync state machine — a TypeScript port of wharf-tui's
// sync.Engine (engine.go), keyed on (localChanged, remoteMoved):
//
//   no / no   → in sync, nothing to do
//   yes / no  → push (PUT with expectedVersion; a 409 re-runs the pass once)
//   no / yes  → fast-forward pull: open the remote blob and adopt its payload
//   yes / yes → conflict — unless one side has zero hosts, in which case the
//               non-empty side wins automatically (first sync after pairing);
//               otherwise the user chooses via resolve().
//
// localChanged is a fingerprint comparison (SHA-256 of the payload); remoteMoved
// is a version comparison. The pending remote payload for an unresolved conflict
// is stashed here in memory (never in Redux) so resolve() need not refetch.
//
// This class holds NO secrets and touches NO globals: every effect goes through
// the injected PersonalSyncDeps, so tests exercise all four quadrants + the 409
// re-pass + zero-hosts auto-resolution + adopt with fakes.

import { countHosts, fingerprint } from "./fingerprint";
import type { PersonalOutcome, PersonalSyncDeps } from "./types";
import { VaultConflictError } from "./types";

// The internal result of a push attempt, before mapping to a PersonalOutcome.
type PushResult = { kind: "pushed"; version: number } | { kind: "conflict" } | { kind: "offline" };

export class PersonalSyncEngine {
  private pending: { payload: Uint8Array; version: number } | null = null;

  constructor(private readonly deps: PersonalSyncDeps) {}

  // Whether a conflict is awaiting the user's keep-local / take-remote choice.
  hasPending(): boolean {
    return this.pending !== null;
  }

  // Run one full sync pass against the current local payload.
  async sync(): Promise<PersonalOutcome> {
    return this.pass(true);
  }

  // pass is one evaluation. retryOn409 permits a single re-pass after a lost
  // push race (the remote is refetched and re-evaluated).
  private async pass(retryOn409: boolean): Promise<PersonalOutcome> {
    const payload = this.deps.currentPayload();
    const fp = fingerprint(payload);
    const state = await this.deps.loadState();

    let remote: Awaited<ReturnType<PersonalSyncDeps["fetchRemote"]>>;
    try {
      remote = await this.deps.fetchRemote();
    } catch {
      return { kind: "offline" };
    }

    if (remote.status === "absent") {
      // No remote vault row. This backend cannot create one via PUT (it 404s),
      // so an empty local vault has nothing to establish and a non-empty one
      // cannot push — either way there is nothing this pass can do. (Deviation
      // from engine.go, which pushes into ErrNoVault; documented in the report.)
      return { kind: "in-sync", version: state.version };
    }

    const localChanged = fp !== state.fingerprint;
    const remoteMoved = remote.version !== state.version;

    if (!localChanged && !remoteMoved) {
      return { kind: "in-sync", version: remote.version };
    }
    if (localChanged && !remoteMoved) {
      return this.push(fp, remote.version, retryOn409);
    }

    // Remote moved: we need its payload to compare / adopt.
    const opened = await this.deps.openRemote(remote.blob);
    if (opened === "needs-password") {
      return { kind: "needs-password" };
    }
    const remotePayload = opened;
    const rfp = fingerprint(remotePayload);
    if (rfp === fp) {
      // Same content both sides — just record agreement at the remote version.
      await this.deps.commit(remote.version, fp);
      return { kind: "in-sync", version: remote.version };
    }
    if (!localChanged) {
      await this.deps.adopt(remotePayload, remote.version);
      return { kind: "adopted", version: remote.version };
    }

    // Both changed. Zero-hosts auto-pick keeps the first sync after pairing
    // silent; a genuinely divergent pair is the user's call.
    const localHosts = countHosts(payload);
    const remoteHosts = countHosts(remotePayload);
    if (localHosts === 0) {
      await this.deps.adopt(remotePayload, remote.version);
      return { kind: "adopted", version: remote.version };
    }
    if (remoteHosts === 0) {
      return this.push(fp, remote.version, retryOn409);
    }
    this.pending = { payload: remotePayload, version: remote.version };
    return {
      kind: "conflict",
      conflict: {
        localHosts,
        remoteHosts,
        remoteVersion: remote.version,
        remoteUpdatedAt: remote.updatedAt,
      },
    };
  }

  // push uploads the local blob with optimistic versioning and maps the result.
  private async push(fp: string, expected: number, retryOn409: boolean): Promise<PersonalOutcome> {
    const result = await this.attemptPush(expected);
    if (result.kind === "pushed") {
      await this.deps.commit(result.version, fp);
      this.pending = null;
      return { kind: "pushed", version: result.version };
    }
    if (result.kind === "conflict" && retryOn409) {
      // Someone pushed first: pull their state and re-evaluate exactly once.
      return this.pass(false);
    }
    // A second conflict, or a network failure, both surface as offline.
    return { kind: "offline" };
  }

  private async attemptPush(expected: number): Promise<PushResult> {
    try {
      const version = await this.deps.pushRemote(expected);
      return { kind: "pushed", version };
    } catch (error) {
      if (error instanceof VaultConflictError) {
        return { kind: "conflict" };
      }
      return { kind: "offline" };
    }
  }

  // resolve settles a pending conflict: keep local (overwrite remote) or take
  // remote (discard local changes). No pending → the conflict evaporated
  // (resolved on another device); re-sync from scratch.
  async resolve(keepLocal: boolean): Promise<PersonalOutcome> {
    const pending = this.pending;
    if (!pending) {
      return this.pass(true);
    }
    if (!keepLocal) {
      await this.deps.adopt(pending.payload, pending.version);
      this.pending = null;
      return { kind: "adopted", version: pending.version };
    }
    const payload = this.deps.currentPayload();
    const fp = fingerprint(payload);
    const result = await this.attemptPush(pending.version);
    this.pending = null;
    if (result.kind === "pushed") {
      await this.deps.commit(result.version, fp);
      return { kind: "pushed", version: result.version };
    }
    if (result.kind === "conflict") {
      // The remote moved again mid-conflict; start the whole pass over.
      return this.pass(true);
    }
    return { kind: "offline" };
  }
}
