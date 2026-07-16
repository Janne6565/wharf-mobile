// Logic for the host detail screen: resolves the route's hostId against the
// decrypted host list, and owns the edit-navigation + delete actions. Delete runs
// the document mutation (re-seal + scheduled push) and pops back to the list. The
// confirmation Alert's copy is passed in from the screen (t() stays in the JSX).

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
  const { hostId } = useLocalSearchParams<{ hostId: string }>();
  const router = useRouter();
  const host = useAppSelector((state) => state.vault.hosts.find((h) => h.id === hostId));

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
    goBack,
    openEdit,
    confirmDelete,
    isDeleting: deletion.isPending,
  };
}
