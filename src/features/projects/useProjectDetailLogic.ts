// Logic for the project detail screen: resolves the route's projectId against the
// synced projects state (for the title + decrypted hosts) and fetches the full
// project detail (members + invites) on demand via React Query, since members are
// not part of the projects-list summary. Owns the back + open-host navigation and
// — for admin/owner callers (M5, light admin) — the invite + revoke mutations and
// the invite sheet's visibility.

import { useMutation, useQuery, useQueryClient } from "@tanstack/react-query";
import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import { getHttpStatus } from "@/api/httpError";
import { createInvite, getProject, revokeInvite } from "@/api/wharf";
import { useAppSelector } from "@/store/hooks";
import { runProjectsSync } from "@/sync/projectsEngine";
import { canAdminister } from "./lib";

const CONFLICT = 409;
const RATE_LIMITED = 429;

// The invite failure surfaced to the sheet: a 409 (already member/invited), a 429
// (rate limited), or any other failure (generic). Null when there is no error.
export type InviteErrorKind = "conflict" | "rateLimited" | "generic" | null;

export interface RevokeConfirmCopy {
  readonly title: string;
  readonly body: string;
  readonly confirm: string;
  readonly cancel: string;
}

export function useProjectDetailLogic() {
  const { projectId } = useLocalSearchParams<{ projectId: string }>();
  const router = useRouter();
  const qc = useQueryClient();
  const project = useAppSelector((state) =>
    state.projects.projects.find((p) => p.id === projectId),
  );
  const currentUserId = useAppSelector((state) => state.auth.user?.id);

  const detailKey = ["project", projectId] as const;
  const detailQuery = useQuery({
    queryKey: detailKey,
    queryFn: () => getProject(projectId ?? ""),
    enabled: Boolean(projectId),
  });

  // The admin gate comes from the freshly-fetched detail role (authoritative),
  // falling back to the synced summary role while the detail is loading.
  const role = detailQuery.data?.role ?? project?.role;
  const canAdmin = canAdminister(role);

  const refresh = useCallback(() => {
    void qc.invalidateQueries({ queryKey: ["project", projectId] });
  }, [qc, projectId]);

  const [inviteOpen, setInviteOpen] = useState(false);

  const inviteMutation = useMutation({
    mutationFn: (email: string) => createInvite(projectId ?? "", { email }),
    onSuccess: () => {
      refresh();
      // Re-fire the projects sync so the finalize pass runs again: a member who
      // accepted an earlier invite may already be pending a key.
      void runProjectsSync();
    },
  });
  const inviteError: InviteErrorKind = inviteMutation.isError
    ? getHttpStatus(inviteMutation.error) === CONFLICT
      ? "conflict"
      : getHttpStatus(inviteMutation.error) === RATE_LIMITED
        ? "rateLimited"
        : "generic"
    : null;

  const revokeMutation = useMutation({
    mutationFn: (inviteId: string) => revokeInvite(projectId ?? "", inviteId),
    onSuccess: () => refresh(),
  });

  const openInvite = useCallback(() => setInviteOpen(true), []);
  const closeInvite = useCallback(() => setInviteOpen(false), []);
  const goBack = useCallback(() => router.back(), [router]);

  // Project hosts open the shared host detail, tagged with the projectId so the
  // detail resolves the host from the project view and renders it read-only.
  const openHost = useCallback(
    (hostId: string) => {
      router.push({ pathname: "/(tabs)/hosts/[hostId]", params: { hostId, projectId } });
    },
    [router, projectId],
  );

  const confirmRevoke = useCallback(
    (inviteId: string, copy: RevokeConfirmCopy) => {
      Alert.alert(copy.title, copy.body, [
        { text: copy.cancel, style: "cancel" },
        {
          text: copy.confirm,
          style: "destructive",
          onPress: () => revokeMutation.mutate(inviteId),
        },
      ]);
    },
    [revokeMutation],
  );

  return {
    project,
    hosts: project?.hosts ?? [],
    members: detailQuery.data?.members ?? [],
    invites: detailQuery.data?.invites ?? [],
    currentUserId,
    canAdmin,
    loadingDetail: detailQuery.isLoading,
    goBack,
    openHost,
    // Invite sheet + mutation.
    inviteOpen,
    openInvite,
    closeInvite,
    inviteMember: (email: string) => inviteMutation.mutate(email),
    inviteSaving: inviteMutation.isPending,
    inviteError,
    inviteDone: inviteMutation.isSuccess,
    resetInvite: () => inviteMutation.reset(),
    // Revoke (per pending invite row).
    confirmRevoke,
    revokingId: revokeMutation.isPending ? revokeMutation.variables : undefined,
  };
}
