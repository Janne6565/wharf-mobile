// Logic for the Hosts tab: reads the decrypted personal host list from the vault
// slice and the decrypted project hosts from the projects slice, applies the live
// search filter, and groups into sections (project sections first, then PERSONAL —
// the mock order). Status dots are static "unknown" (grey); reachability probing
// is a later milestone.

import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { HostStatus } from "@/components";
import { useAppSelector } from "@/store/hooks";
import { hostTarget } from "@/vault/document";
import { filterHosts, groupHosts, type ProjectHostGroup } from "./lib";

export interface HostRowData {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly status: HostStatus;
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
  const router = useRouter();
  const [query, setQuery] = useState("");

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
          status: "unknown" as const,
          ...(projectId ? { projectId } : {}),
        })),
      };
    });
  }, [personal, projects, query]);

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
