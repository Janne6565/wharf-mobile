// Logic for the Projects tab: reads the derived projects state (populated by the
// projects sync pass), fires the pass lazily on tab focus, and owns the
// accept/decline invite mutations. Per REACT.md all state/selectors/effects live
// here; the screen stays thin JSX.

import { useMutation } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback } from "react";
import { acceptInvite as apiAccept, declineInvite as apiDecline } from "@/api/wharf";
import { useAppSelector } from "@/store/hooks";
import { runProjectsSync } from "@/sync/projectsEngine";

interface RespondVars {
  readonly inviteId: string;
  readonly accept: boolean;
}

export function useProjectsLogic() {
  const router = useRouter();
  const projects = useAppSelector((state) => state.projects.projects);
  const invites = useAppSelector((state) => state.projects.invites);
  const phase = useAppSelector((state) => state.projects.phase);
  const loaded = useAppSelector((state) => state.projects.loaded);
  const offline = useAppSelector((state) => state.projects.offline);
  const identityNeedsSync = useAppSelector((state) => state.projects.identityNeedsSync);

  // Lazy: the first Projects focus triggers identity bootstrap + the projects
  // pass. Single-flight in the orchestrator, so re-firing on every focus is safe.
  useFocusEffect(
    useCallback(() => {
      void runProjectsSync();
    }, []),
  );

  const respond = useMutation({
    mutationFn: async ({ inviteId, accept }: RespondVars) => {
      if (accept) {
        await apiAccept(inviteId);
      } else {
        await apiDecline(inviteId);
      }
    },
    // Accept joins as an awaiting-key member; decline drops the invite. Either way
    // a fresh pass reconciles the projects + invites lists (410-expired included).
    onSettled: () => {
      void runProjectsSync();
    },
  });

  const acceptInvite = useCallback(
    (inviteId: string) => respond.mutate({ inviteId, accept: true }),
    [respond],
  );
  const declineInvite = useCallback(
    (inviteId: string) => respond.mutate({ inviteId, accept: false }),
    [respond],
  );
  const respondingId = respond.isPending ? respond.variables?.inviteId : undefined;

  const openProject = useCallback(
    (projectId: string) => {
      router.push({ pathname: "/(tabs)/projects/[projectId]", params: { projectId } });
    },
    [router],
  );

  const showLoading = !loaded && phase === "syncing";
  const showEmpty = loaded && !identityNeedsSync && projects.length === 0 && invites.length === 0;

  return {
    projects,
    invites,
    offline,
    identityNeedsSync,
    openProject,
    acceptInvite,
    declineInvite,
    respondingId,
    showLoading,
    showEmpty,
  };
}
