// Logic for the Hosts tab: reads the decrypted personal host list from the vault
// slice and the decrypted project hosts from the projects slice, applies the live
// search filter, and groups into sections (project sections first, then PERSONAL —
// the mock order). Every host is TCP-probed for reachability on focus (see
// useHostProbes) and its status dot is coloured by the result (grey until probed).

import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { HostStatus } from "@/components";
import { useAppSelector } from "@/store/hooks";
import { runProjectsSync } from "@/sync/projectsEngine";
import { hostTarget } from "@/vault/document";
import { filterHosts, groupHosts, type ProjectHostGroup } from "./lib";
import { type ProbeTarget, useHostProbes } from "./useHostProbes";

export interface HostRowData {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly status: HostStatus;
  // The last measured probe RTT (ms); set only when a probe result exists. The
  // row gates display on online/degraded status.
  readonly rttMs?: number;
  // Set for a project host so navigation can tag the detail with its project.
  readonly projectId?: string;
}

export interface HostSectionData {
  readonly kind: "personal" | "project";
  readonly key: string;
  // The project name (undefined for the personal section; the screen renders the
  // i18n "PERSONAL" label there).
  readonly name?: string;
  readonly hosts: readonly HostRowData[];
}

export function useHostsLogic() {
  const personal = useAppSelector((state) => state.vault.hosts);
  const projects = useAppSelector((state) => state.projects.projects);
  const probeResults = useAppSelector((state) => state.probes.results);
  const router = useRouter();
  const [query, setQuery] = useState("");

  // The Hosts tab renders project host sections too, so it must also kick the
  // projects pass — otherwise project hosts only appear after the Projects tab is
  // first visited. Single-flight and auth/unlock-guarded in the orchestrator, so
  // re-firing on every focus is safe; the offline path serves the disk cache.
  useFocusEffect(
    useCallback(() => {
      void runProjectsSync();
    }, []),
  );

  // Probe every host on this tab (personal + all project hosts), keyed by host id.
  // Built from the full lists (not the filtered view) so the search box never
  // changes what gets probed.
  const targets: readonly ProbeTarget[] = useMemo(() => {
    const all = [...personal, ...projects.flatMap((project) => project.hosts)];
    return all.map((host) => ({ id: host.id, host: host.addr, port: host.port }));
  }, [personal, projects]);
  useHostProbes(targets);

  const sections: readonly HostSectionData[] = useMemo(() => {
    const projectGroups: ProjectHostGroup[] = projects
      .filter((project) => !project.awaiting && project.hosts.length > 0)
      .map((project) => ({ id: project.id, name: project.name, hosts: project.hosts }));

    return groupHosts(personal, projectGroups).map((section) => {
      const projectId = section.kind === "project" ? section.projectId : undefined;
      return {
        kind: section.kind,
        key: section.kind === "project" ? `project:${section.projectId}` : "personal",
        ...(section.kind === "project" ? { name: section.name } : {}),
        hosts: filterHosts(section.hosts, query).map((host) => ({
          id: host.id,
          name: host.name,
          target: hostTarget(host),
          status: probeResults[host.id]?.status ?? "unknown",
          ...(probeResults[host.id] ? { rttMs: probeResults[host.id].rttMs } : {}),
          ...(projectId ? { projectId } : {}),
        })),
      };
    });
  }, [personal, projects, probeResults, query]);

  const openHost = useCallback(
    (hostId: string, projectId?: string) => {
      router.push({
        pathname: "/(tabs)/hosts/[hostId]",
        params: projectId ? { hostId, projectId } : { hostId },
      });
    },
    [router],
  );

  const openAddHost = useCallback(() => {
    router.push("/(tabs)/hosts/edit");
  }, [router]);

  const totalHosts = personal.length + projects.reduce((sum, p) => sum + p.hosts.length, 0);
  const hasHosts = totalHosts > 0;
  const hasMatches = sections.some((section) => section.hosts.length > 0);

  return { sections, query, setQuery, openHost, openAddHost, hasHosts, hasMatches };
}
