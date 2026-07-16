// Logic for the host detail screen. Resolves the route's hostId against either the
// personal vault host list or — when a projectId is present — a project's decrypted
// host list. Personal hosts own edit + delete; project hosts are READ-ONLY on
// mobile v1 (the plan defers project host editing), so the screen shows a project
// badge and suppresses those actions. The confirmation Alert's copy is passed in
// from the screen (t() stays in the JSX).

import { useMutation } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { Alert } from "react-native";
import { useAppSelector } from "@/store/hooks";
import { hostTarget } from "@/vault/document";
import { deleteHost } from "@/vault/hostMutations";

export interface DeleteConfirmCopy {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly cancel: string;
}

export function useHostDetailLogic() {
  const { hostId, projectId } = useLocalSearchParams<{ hostId: string; projectId?: string }>();
  const router = useRouter();

  const personalHost = useAppSelector((state) => state.vault.hosts.find((h) => h.id === hostId));
  const project = useAppSelector((state) =>
    projectId ? state.projects.projects.find((p) => p.id === projectId) : undefined,
  );
  const projectHost = project?.hosts.find((h) => h.id === hostId);

  const isProjectHost = Boolean(projectId);
  const host = isProjectHost ? projectHost : personalHost;

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  const openEdit = useCallback(() => {
    if (hostId) {
      router.push({ pathname: "/(tabs)/hosts/edit", params: { hostId } });
    }
  }, [router, hostId]);

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
    isProjectHost,
    projectName: project?.name,
    goBack,
    openEdit,
    confirmDelete,
    isDeleting: deletion.isPending,
  };
}
