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

export interface HostSection {
  // i18n key discriminator — "personal" is the only section until projects (M4).
  readonly kind: "personal";
  readonly hosts: readonly VaultHost[];
}

// Group hosts into display sections. Personal-only for now: project grouping
// (mock's ATLAS PLATFORM section) arrives with the projects milestone; the
// shape is already section-based so M4 only adds section kinds.
export function groupHosts(hosts: readonly VaultHost[]): readonly HostSection[] {
  return [{ kind: "personal", hosts }];
}
