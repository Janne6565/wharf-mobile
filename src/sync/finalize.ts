// The admin/owner finalize pass of the accept-then-finalize invite flow (M5). A
// member who accepts an invite joins with no wrapped DEK (awaiting-key); it is
// any admin/owner client that, on its next projects pass, seals the project DEK
// to each such member's published public key and submits it. Mobile v1 runs this
// opportunistically after the read pass, so the phone improves invite latency
// when it is the only online admin surface (the plan's "member-plus" scope).
//
// Best-effort and isolated, mirroring wharf-web's finalize.ts: every project and
// every member is wrapped in its own try/catch so one failure never blocks the
// rest, and a 409 (the vault rotated since we read it, so a stale DEK is refused)
// is skipped silently — a later pass re-wraps against the current version.
//
// The engine is pure: it holds no secrets and touches no globals. All crypto and
// I/O go through the injected FinalizeDeps (finalizeDeps.ts wires the real ones),
// so tests exercise the seal→submit path, the stale-409 skip, per-member error
// isolation and the non-admin / not-keyed skips against fakes.

import { getHttpStatus } from "@/api/httpError";
import type { FinalizeDeps, FinalizeTarget, ProjectRoleName } from "./projectTypes";

const CONFLICT = 409;

function canFinalize(role: ProjectRoleName): boolean {
  return role === "ADMIN" || role === "OWNER";
}

// finalizeProject seals and submits the DEK for every pending member of one
// project. Returns early (does nothing) when we hold no openable DEK — we cannot
// seal for others until we ourselves are keyed; a later pass picks it up.
async function finalizeProject(deps: FinalizeDeps, id: string): Promise<void> {
  const remote = await deps.fetchVault(id);
  if (remote.status !== "present" || !remote.wrappedDek) {
    return;
  }
  const dek = await deps.openDek(remote.wrappedDek);
  if (!dek) {
    return;
  }

  const pending = await deps.getPendingKeys(id);
  for (const member of pending) {
    try {
      const wrappedDek = await deps.sealDek(dek, member.publicKey);
      await deps.submitMemberKey(id, member.userId, wrappedDek, remote.version);
    } catch (error) {
      // 409 = the vault rotated since we read it; the stale DEK is refused. Any
      // other per-member failure is likewise non-fatal to the rest of the pass —
      // both are swallowed so the next member (and the next project) still runs.
      if (getHttpStatus(error) !== CONFLICT && __DEV__) {
        console.warn(`[finalize] member ${member.userId} in project ${id} failed`, error);
      }
    }
  }
}

// runFinalizePass seals and submits the DEK for every pending member across the
// caller's admin/owner targets. Resolves once every project has been attempted;
// never rejects (project-level failures are isolated), so callers can await it
// after the read pass without guarding it.
export async function runFinalizePass(
  deps: FinalizeDeps,
  targets: readonly FinalizeTarget[],
): Promise<void> {
  for (const target of targets) {
    if (!target.id || !canFinalize(target.role)) {
      continue;
    }
    try {
      await finalizeProject(deps, target.id);
    } catch (error) {
      // Project-level failure (e.g. we lost access mid-pass) is isolated so the
      // remaining projects still finalize.
      if (__DEV__) {
        console.warn(`[finalize] project ${target.id} failed`, error);
      }
    }
  }
}
