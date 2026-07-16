// Logic for the read-only host detail screen: resolves the route's hostId
// against the decrypted host list in the vault slice.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { useAppSelector } from "@/store/hooks";
import { hostTarget } from "@/vault/document";

export function useHostDetailLogic() {
  const { hostId } = useLocalSearchParams<{ hostId: string }>();
  const router = useRouter();
  const host = useAppSelector((state) => state.vault.hosts.find((h) => h.id === hostId));

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  return {
    host,
    target: host ? hostTarget(host) : "",
    goBack,
  };
}
