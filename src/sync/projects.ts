// The project-vault sync engine — the projects analogue of PersonalSyncEngine
// (personal.ts). A full pass lists the caller's projects, drops any that vanished
// (membership revoked / project deleted), and for each remaining project unwraps
// the caller's wrapped DEK (delivered fresh on every fetch, so rotations are
// handled statelessly — never a cached DEK), opens the blob and reads its hosts.
//
// Mobile v1 project vaults are READ-ONLY (the plan defers project host editing), so
// this engine only ever fast-forward-pulls: there is no push, no per-project 2×2
// state machine, and no conflict path. This is an intentional v1 deviation from
// the TUI/web engines, which carry the full push + rotate + finalize machinery.
//
// The class holds NO secrets and touches NO globals: every effect goes through the
// injected ProjectSyncDeps (which own the identity + crypto), so tests exercise the
// unwrap→open→cache path, the awaiting-access branches, the vanished-drop and the
// offline cached path with fakes.

import type { ProjectSummary } from "@/api/generated/model";
import { toBase64 } from "@/crypto";
import { parseProjectHosts } from "@/vault/projectDocument";
import type { ProjectMetaEntry } from "@/vault/storage";
import { fingerprint } from "./fingerprint";
import type {
  InviteView,
  ProjectRoleName,
  ProjectSyncDeps,
  ProjectsOutcome,
  ProjectView,
} from "./projectTypes";

function roleOf(summary: ProjectSummary): ProjectRoleName {
  return summary.role === "ADMIN" || summary.role === "OWNER" ? summary.role : "MEMBER";
}

// baseView projects a summary onto the non-secret display fields shared by the
// keyed and awaiting branches.
function baseView(summary: ProjectSummary): Omit<ProjectView, "awaiting" | "hosts"> {
  return {
    id: summary.id ?? "",
    name: summary.name ?? "",
    description: summary.description ?? "",
    role: roleOf(summary),
    memberCount: summary.memberCount ?? 0,
    pendingInviteCount: summary.pendingInviteCount ?? 0,
    version: summary.vaultVersion ?? 0,
  };
}

export class ProjectSyncEngine {
  constructor(private readonly deps: ProjectSyncDeps) {}

  // Run one full projects pass.
  async sync(): Promise<ProjectsOutcome> {
    let list: readonly ProjectSummary[];
    try {
      list = await this.deps.listProjects();
    } catch {
      // Offline: fall back to the on-disk blob cache so hosts still render.
      return { kind: "offline", views: await this.cachedViews() };
    }

    const invites = await this.deps.fetchInvites().catch(() => [] as readonly InviteView[]);
    const meta = await this.deps.loadMeta();

    const live = new Set(list.map((s) => s.id));
    const removed: string[] = [];
    for (const id of Object.keys(meta)) {
      if (!live.has(id)) {
        await this.deps.dropProject(id);
        removed.push(id);
      }
    }

    const views: ProjectView[] = [];
    for (const summary of list) {
      views.push(await this.syncOne(summary, removed));
    }

    return { kind: "ok", views: views.filter((v) => v.id !== ""), removed, invites: [...invites] };
  }

  // syncOne resolves one project's view, recording a vanished project into
  // `removed` (its view is returned with an empty id and filtered out by sync()).
  private async syncOne(summary: ProjectSummary, removed: string[]): Promise<ProjectView> {
    const base = baseView(summary);
    const awaiting: ProjectView = { ...base, awaiting: true, hosts: [] };
    if (!base.id || summary.awaitingKey) {
      return awaiting;
    }

    const remote = await this.deps.fetchVault(base.id);
    if (remote.status === "not-found") {
      await this.deps.dropProject(base.id);
      removed.push(base.id);
      return { ...awaiting, id: "" };
    }
    if (!remote.blob || !remote.wrappedDek) {
      return awaiting;
    }
    const dek = await this.deps.openDek(remote.wrappedDek);
    if (!dek) {
      return awaiting;
    }
    const payload = await this.deps.openBlob(dek, remote.blob);
    if (!payload) {
      return awaiting;
    }

    const entry: ProjectMetaEntry = {
      name: base.name,
      role: base.role,
      version: remote.version,
      fingerprint: fingerprint(payload),
      wrappedDek: toBase64(remote.wrappedDek),
    };
    await this.deps.cacheProject(base.id, entry, remote.blob);
    return {
      ...base,
      version: remote.version,
      awaiting: false,
      hosts: parseProjectHosts(payload),
    };
  }

  // cachedViews opens the on-disk blob cache using the persisted wrapped DEKs, so
  // an unlocked-but-offline client can render project hosts without the network.
  private async cachedViews(): Promise<ProjectView[]> {
    const meta = await this.deps.loadMeta();
    const views: ProjectView[] = [];
    for (const [id, entry] of Object.entries(meta)) {
      const payload = await this.deps.loadCached(id, entry);
      const base = {
        id,
        name: entry.name,
        description: "",
        role: (entry.role === "ADMIN" || entry.role === "OWNER"
          ? entry.role
          : "MEMBER") as ProjectRoleName,
        memberCount: 0,
        pendingInviteCount: 0,
        version: entry.version,
      };
      views.push(
        payload
          ? { ...base, awaiting: false, hosts: parseProjectHosts(payload) }
          : { ...base, awaiting: true, hosts: [] },
      );
    }
    return views;
  }
}
