// Logic for the Hosts tab: reads the decrypted host list from the vault slice
// (populated on unlock), applies the live search filter, and groups into
// sections (PERSONAL only until projects land in M4). Status dots are static
// "unknown" (gray) — reachability probing is a later milestone.

import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import type { HostStatus } from "@/components";
import { useAppSelector } from "@/store/hooks";
import { hostTarget } from "@/vault/document";
import { filterHosts, groupHosts } from "./lib";

export interface HostRowData {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly status: HostStatus;
}

export interface HostSectionData {
  readonly kind: "personal";
  readonly hosts: readonly HostRowData[];
}

export function useHostsLogic() {
  const hosts = useAppSelector((state) => state.vault.hosts);
  const router = useRouter();
  const [query, setQuery] = useState("");

  const sections: readonly HostSectionData[] = useMemo(() => {
    const filtered = filterHosts(hosts, query);
    return groupHosts(filtered).map((section) => ({
      kind: section.kind,
      hosts: section.hosts.map((host) => ({
        id: host.id,
        name: host.name,
        target: hostTarget(host),
        status: "unknown" as const,
      })),
    }));
  }, [hosts, query]);

  const openHost = useCallback(
    (hostId: string) => {
      router.push({ pathname: "/(tabs)/hosts/[hostId]", params: { hostId } });
    },
    [router],
  );

  const hasHosts = hosts.length > 0;
  const hasMatches = sections.some((section) => section.hosts.length > 0);

  return { sections, query, setQuery, openHost, hasHosts, hasMatches };
}
