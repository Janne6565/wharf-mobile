// Pure host list helpers: search filtering, section grouping, and probe result
// classification. Framework-free so they are unit-testable without React
// (REACT.md lib.ts convention).

import { hostTarget, type VaultHost } from "@/vault/document";

// One probe = a TCP dial bounded by this timeout (mirrors wharf-tui
// probe.DefaultTimeout). Passed to the native probe() as timeoutMs.
export const PROBE_TIMEOUT_MS = 3000;

// Dial RTT above which a reachable host is flagged "degraded" instead of
// "online" — parity with wharf-tui probe.DegradedRTT.
export const DEGRADED_RTT_MS = 750;

// The advisory reachability of a host, mapped to a status-dot colour. Distinct
// from "unknown" (unprobed / probe failed to run), which is not a probe result.
export type ProbeStatus = "online" | "degraded" | "offline";

// Classify a native probe RTT (milliseconds, -1 for an unreachable dial) into a
// status. Mirrors wharf-tui's probeStatusText mapping: a failed dial is offline,
// a slow-but-reachable dial is degraded, and everything else is online.
export function classifyProbe(rttMs: number): ProbeStatus {
  if (rttMs < 0) {
    return "offline";
  }
  if (rttMs > DEGRADED_RTT_MS) {
    return "degraded";
  }
  return "online";
}

// Case-insensitive substring match over the fields a user would search by:
// name, user, address, the rendered user@addr:port target, and tags.
export function filterHosts(hosts: readonly VaultHost[], query: string): readonly VaultHost[] {
  const needle = query.trim().toLowerCase();
  if (!needle) {
    return hosts;
  }
  return hosts.filter((host) => {
    const haystack = [host.name, host.user, host.addr, hostTarget(host), ...(host.tags ?? [])]
      .join("\n")
      .toLowerCase();
    return haystack.includes(needle);
  });
}

// A project's hosts, ready to be grouped into its own Hosts-tab section.
export interface ProjectHostGroup {
  readonly id: string;
  readonly name: string;
  readonly hosts: readonly VaultHost[];
}

// A Hosts-tab display section: one per project (labelled by the project name) plus
// a trailing personal section (labelled "PERSONAL" via i18n in the screen).
export type HostSection =
  | { readonly kind: "personal"; readonly hosts: readonly VaultHost[] }
  | {
      readonly kind: "project";
      readonly projectId: string;
      readonly name: string;
      readonly hosts: readonly VaultHost[];
    };

// Group hosts into display sections: project sections first, then personal —
// matching the mock (ATLAS PLATFORM before PERSONAL). Project host lists are
// read-only; the screen renders their sections identically but the host detail
// suppresses edit/delete.
export function groupHosts(
  personal: readonly VaultHost[],
  projects: readonly ProjectHostGroup[],
): readonly HostSection[] {
  const projectSections: HostSection[] = projects.map((project) => ({
    kind: "project",
    projectId: project.id,
    name: project.name,
    hosts: project.hosts,
  }));
  return [...projectSections, { kind: "personal", hosts: personal }];
}
