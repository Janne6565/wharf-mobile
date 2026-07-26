// Logic for the Projects tab: reads the derived projects state (populated by the
// projects sync pass), fires the pass lazily on tab focus, and owns the
// accept/decline invite mutations. Per REACT.md all state/selectors/effects live
// here; the screen stays thin JSX.

import { useMutation } from "@tanstack/react-query";
import { useFocusEffect, useRouter } from "expo-router";
import { useCallback, useState } from "react";
import { Alert } from "react-native";
import {
  acceptInvite as apiAccept,
  createProject as apiCreate,
  declineInvite as apiDecline,
} from "@/api/wharf";
import { store } from "@/store";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { identityKeyMismatchCleared } from "@/store/projectsSlice";
import { showToast } from "@/store/toastSlice";
import { runProjectsSync } from "@/sync/projectsEngine";
import { ensureIdentity, republishLocalPublicKey } from "@/vault/identity";
import { buildCreateProject } from "@/vault/projectCreate";
import type { ConfirmCopy } from "./useProjectDetailLogic";

interface RespondVars {
  readonly inviteId: string;
  readonly accept: boolean;
}

interface CreateVars {
  readonly name: string;
  readonly description: string;
}

// Distinguishes the "this vault has no project identity yet on this device"
// failure (the caller must sync first) from a generic create failure, so the
// create mutation can surface a distinct, actionable toast.
class ProjectNeedsSyncError extends Error {}

// The account's published key is not the one in this vault: creating a project
// would publish membership against a key directory we know to be wrong, so the
// create is refused with its own toast rather than the needs-sync one.
class ProjectKeyMismatchError extends Error {}

export function useProjectsLogic() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const invites = useAppSelector((state) => state.projects.invites);
  const phase = useAppSelector((state) => state.projects.phase);
  const loaded = useAppSelector((state) => state.projects.loaded);
  const offline = useAppSelector((state) => state.projects.offline);
  const identityNeedsSync = useAppSelector((state) => state.projects.identityNeedsSync);
  const keyMismatch = useAppSelector((state) => state.projects.identityKeyMismatch);

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
    onError: (_error, { accept }) =>
      dispatch(
        showToast({
          messageKey: accept ? "toast.acceptFailed" : "toast.declineFailed",
          kind: "error",
        }),
      ),
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

  // Create-project sheet + mutation. The mutation ensures the account's project
  // identity is present on this device first (bootstrapping it if absent), then
  // seals a fresh empty project blob + owner-wrapped DEK and POSTs it. A projects
  // sync pass on success reconciles the new project into the list.
  const [createOpen, setCreateOpen] = useState(false);
  const openCreate = useCallback(() => setCreateOpen(true), []);
  const closeCreate = useCallback(() => setCreateOpen(false), []);

  const createMutation = useMutation({
    mutationFn: async ({ name, description }: CreateVars) => {
      // Mirror the projects engine's expectedVersion: the server version the local
      // vault is based on, so an identity-bootstrap PUT uses the right baseline.
      const expectedVersion = store.getState().vault.version ?? 0;
      const identity = await ensureIdentity(expectedVersion);
      if (identity.kind === "needs-sync") {
        throw new ProjectNeedsSyncError();
      }
      if (identity.kind === "key-mismatch") {
        throw new ProjectKeyMismatchError();
      }
      const { vault, wrappedDek } = await buildCreateProject(identity.keys.publicKey);
      await apiCreate({
        name: name.trim(),
        description: description.trim() || undefined,
        vault,
        wrappedDek,
      });
    },
    onSuccess: () => {
      dispatch(showToast({ messageKey: "toast.projectCreated", kind: "success" }));
      closeCreate();
      void runProjectsSync();
    },
    onError: (error) =>
      dispatch(
        showToast({
          messageKey:
            error instanceof ProjectNeedsSyncError
              ? "toast.projectCreateNeedsSync"
              : error instanceof ProjectKeyMismatchError
                ? "toast.projectCreateKeyMismatch"
                : "toast.projectCreateFailed",
          kind: "error",
        }),
      ),
  });

  const submitCreate = useCallback(
    (name: string, description: string) => createMutation.mutate({ name, description }),
    [createMutation],
  );

  // Mismatch remediation: re-publish the public key THIS vault holds, with
  // rotate:true so the server takes it over its own copy. No new keypair is minted
  // — the local key is the correct one. rotate:true discards every wrapped project
  // DEK server-side, so the action is only fired from an explicit confirmation.
  const republishMutation = useMutation({
    mutationFn: () => republishLocalPublicKey(),
    onSuccess: () => {
      dispatch(showToast({ messageKey: "toast.keyRepublished", kind: "success" }));
      dispatch(identityKeyMismatchCleared());
      void runProjectsSync();
    },
    onError: () => dispatch(showToast({ messageKey: "toast.keyRepublishFailed", kind: "error" })),
  });

  const confirmRepublish = useCallback(
    (copy: ConfirmCopy) => {
      Alert.alert(copy.title, copy.body, [
        { text: copy.cancel, style: "cancel" },
        { text: copy.confirm, style: "destructive", onPress: () => republishMutation.mutate() },
      ]);
    },
    [republishMutation],
  );

  const showLoading = !loaded && phase === "syncing";
  const showEmpty =
    loaded && !identityNeedsSync && !keyMismatch && projects.length === 0 && invites.length === 0;

  return {
    projects,
    invites,
    offline,
    identityNeedsSync,
    keyMismatch,
    confirmRepublish,
    republishing: republishMutation.isPending,
    openProject,
    acceptInvite,
    declineInvite,
    respondingId,
    createOpen,
    openCreate,
    closeCreate,
    submitCreate,
    creating: createMutation.isPending,
    showLoading,
    showEmpty,
  };
}
