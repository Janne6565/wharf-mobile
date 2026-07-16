// Pure host list helpers: search filtering and section grouping. Framework-free
// so they are unit-testable without React (REACT.md lib.ts convention).

import { hostTarget, type VaultHost } from "@/vault/document";

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
