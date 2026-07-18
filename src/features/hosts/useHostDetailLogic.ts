// Logic for the host detail screen. Resolves the route's hostId against either the
// personal vault host list or — when a projectId is present — a project's decrypted
// host list. Personal hosts own edit + delete; project hosts are READ-ONLY on
// mobile v1 (the plan defers project host editing), so the screen shows a project
// badge and suppresses those actions. The confirmation Alert's copy is passed in
// from the screen (t() stays in the JSX).

import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useMemo } from "react";
import { Alert } from "react-native";
import type { HostStatus } from "@/components";
import { useAppSelector } from "@/store/hooks";
import { hostTarget } from "@/vault/document";
import { deleteHost } from "@/vault/hostMutations";
import { type ProbeTarget, useHostProbes } from "./useHostProbes";

export interface DeleteConfirmCopy {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly cancel: string;
}

export function useHostDetailLogic() {
  const { hostId, projectId, from } = useLocalSearchParams<{
    hostId: string;
    projectId?: string;
    from?: string;
  }>();
  const router = useRouter();

  const personalHost = useAppSelector((state) => state.vault.hosts.find((h) => h.id === hostId));
  const project = useAppSelector((state) =>
    projectId ? state.projects.projects.find((p) => p.id === projectId) : undefined,
  );
  const projectHost = project?.hosts.find((h) => h.id === hostId);

  const isProjectHost = Boolean(projectId);
  const host = isProjectHost ? projectHost : personalHost;

  // Probe this host for the status row when the screen is focused.
  const probeResult = useAppSelector((state) => (host ? state.probes.results[host.id] : undefined));
  const probeTargets: readonly ProbeTarget[] = useMemo(
    () => (host ? [{ id: host.id, host: host.addr, port: host.port }] : []),
    [host],
  );
  useHostProbes(probeTargets);
  const status: HostStatus = probeResult?.status ?? "unknown";
  const rttMs = probeResult?.rttMs ?? -1;

  // True when the user arrived here from a project detail (Projects tab). The host
  // detail lives in the Hosts tab's stack, so this push crossed tab stacks — a plain
  // router.back() would pop the Hosts stack to the Hosts overview, not the project.
  const cameFromProject = from === "project" && Boolean(projectId);

  const goBack = useCallback(() => {
    // Coming from a project, back() can't cross tab stacks to reach the project, so
    // navigate to the existing project-detail entry (navigate reuses it rather than
    // pushing a duplicate). Otherwise back() pops the Hosts stack as normal.
    if (cameFromProject && projectId) {
      router.navigate({ pathname: "/(tabs)/projects/[projectId]", params: { projectId } });
      return;
    }
    router.back();
  }, [router, cameFromProject, projectId]);

  const openEdit = useCallback(() => {
    if (hostId) {
      router.push({ pathname: "/(tabs)/hosts/edit", params: { hostId } });
    }
  }, [router, hostId]);

  // Opens the SSH terminal for this host (personal or project), carrying the
  // projectId so the terminal resolves the right host list.
  const openTerminal = useCallback(() => {
    if (hostId) {
      router.push({
        pathname: "/(tabs)/hosts/terminal",
        params: projectId ? { hostId, projectId } : { hostId },
      });
    }
  }, [router, hostId, projectId]);

  const deletion = useMutation({
    mutationFn: () => deleteHost(hostId ?? ""),
    onSuccess: () => router.back(),
  });

  const confirmDelete = useCallback(
    (copy: DeleteConfirmCopy) => {
      Alert.alert(copy.title, copy.body, [
        { text: copy.cancel, style: "cancel" },
        { text: copy.confirm, style: "destructive", onPress: () => deletion.mutate() },
      ]);
    },
    [deletion],
  );

  return {
    host,
    target: host ? hostTarget(host) : "",
    status,
    rttMs,
    isProjectHost,
    cameFromProject,
    projectName: project?.name,
    goBack,
    openEdit,
    openTerminal,
    confirmDelete,
    isDeleting: deletion.isPending,
  };
}
