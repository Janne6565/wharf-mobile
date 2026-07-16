import type { HostStatus } from "@/components";

export interface HostRowData {
  readonly id: string;
  readonly name: string;
  readonly target: string;
  readonly status: HostStatus;
}

// M0 placeholder data mirroring the mock's PERSONAL section. Real hosts come from
// the decrypted vault once sync lands (M3); this hook is the seam where that read
// (a useQuery over the vault) will live.
const PERSONAL_HOSTS: readonly HostRowData[] = [
  { id: "homelab", name: "homelab", target: "deniz@homelab.local:22", status: "reachable" },
];

export function useHostsLogic() {
  return { personalHosts: PERSONAL_HOSTS };
}
