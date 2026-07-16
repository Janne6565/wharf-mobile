// Logic for the project detail screen: resolves the route's projectId against the
// synced projects state (for the title + decrypted hosts) and fetches the full
// project detail (members + invites) on demand via React Query, since members are
// not part of the projects-list summary. Owns the back + open-host navigation.

import { useQuery } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback } from "react";
import { getProject } from "@/api/wharf";
import { useAppSelector } from "@/store/hooks";

export function useProjectDetailLogic() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const project = useAppSelector((state) =>
    state.projects.projects.find((p) => p.id === projectId),
  );
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const detailQuery = useQuery({
    queryKey: ["project", projectId],
    queryFn: () => getProject(projectId ?? ""),
    enabled: Boolean(projectId),
  });

  const goBack = useCallback(() => {
    router.back();
  }, [router]);

  // Project hosts open the shared host detail, tagged with the projectId so the
  // detail resolves the host from the project view and renders it read-only.
  const openHost = useCallback(
    (hostId: string) => {
      router.push({ pathname: "/(tabs)/hosts/[hostId]", params: { hostId, projectId } });
    },
    [router, projectId],
  );

  return {
    project,
    hosts: project?.hosts ?? [],
    members: detailQuery.data?.members ?? [],
    invites: detailQuery.data?.invites ?? [],
    currentUserId,
    loadingDetail: detailQuery.isLoading,
    goBack,
    openHost,
  };
}
