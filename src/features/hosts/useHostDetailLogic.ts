// Logic for the host detail screen. Resolves the route's hostId against either the
// personal vault host list or — when a projectId is present — a project's decrypted
// host list. Personal hosts own edit + delete; project hosts are READ-ONLY on
// mobile v1 (the plan defers project host editing), so the screen shows a project
// badge and suppresses those actions. The confirmation Alert's copy is passed in
// from the screen (t() stays in the JSX).

import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter, useSegments } from "expo-router";
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
  const { hostId, projectId } = useLocalSearchParams<{
    hostId: string;
    projectId?: string;
  }>();
  const router = useRouter();
  // Explicitly widen to a plain string array before indexing: this is deliberate
  // because CI typechecks without the generated typed-routes file
  // (.expo/types/router.d.ts is gitignored), and its absence makes expo-router's
  // fallback types return useSegments() as a one-element tuple `[string]`, so
  // `segments[1]` would fail with TS2493.
  const segments: string[] = useSegments();

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

  // True when this screen is rendering inside the PROJECTS stack — i.e. it was
  // reached via the projects-stack re-export (segments: (tabs)/projects/host/[hostId])
  // rather than the Hosts-tab copy ((tabs)/hosts/[hostId]). Deriving the origin from
  // the route location (not a param) means both router.back() and the native
  // swipe-back gesture pop within the correct stack. The same project host opened from
  // the Hosts tab renders under the hosts stack, so this is false there.
  const inProjectsStack = segments[1] === "projects";
  const cameFromProject = inProjectsStack;

  // Plain back() now works for both stacks: the project host detail lives inside the
  // projects stack, so back() pops to the project detail directly.
  const goBack = useCallback(() => router.back(), [router]);

  const openEdit = useCallback(() => {
    if (hostId) {
      router.push({ pathname: "/(tabs)/hosts/edit", params: { hostId } });
    }
  }, [router, hostId]);

  // Opens the SSH terminal for this host (personal or project), carrying the
  // projectId so the terminal resolves the right host list. When this detail is in
  // the projects stack, the terminal is pushed there too (its projects-stack copy),
  // so closing it pops back to the project detail rather than the Hosts tab.
  const openTerminal = useCallback(() => {
    if (!hostId) {
      return;
    }
    if (inProjectsStack) {
      router.push({
        pathname: "/(tabs)/projects/terminal",
        params: projectId ? { hostId, projectId } : { hostId },
      });
      return;
    }
    router.push({
      pathname: "/(tabs)/hosts/terminal",
      params: projectId ? { hostId, projectId } : { hostId },
    });
  }, [router, hostId, projectId, inProjectsStack]);

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
