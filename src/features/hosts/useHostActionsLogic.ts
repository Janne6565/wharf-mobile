// Logic for the Hosts-tab long-press context menu: which host the menu is open
// for, its four actions (connect / edit / move-to-project / delete), and the
// move-to-project picker. Personal hosts get all four; a project host is read-only
// on mobile v1, so its menu offers Connect only (the screen gates on projectId).
//
// The two mutations (move, delete) live here per REACT.md; the confirmation Alert
// copy and every t() string stay in the JSX (passed into confirmDelete).

import { useMutation } from "@tanstack/react-query";
import { useRouter } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { Alert } from "react-native";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast, type ToastMessageKey } from "@/store/toastSlice";
import { moveHostToProject, ProjectWriteError } from "@/sync/projectVaultWrite";
import { deleteHost } from "@/vault/hostMutations";
import { HostMutationError } from "@/vault/mutate";
import type { DeleteConfirmCopy } from "./useHostDetailLogic";

// The host the menu is currently open for. `projectId` marks a project host
// (Connect-only); its absence marks a personal host (all four actions).
export interface MenuHost {
  readonly id: string;
  readonly name: string;
  readonly projectId?: string;
}

function moveErrorToast(error: unknown): ToastMessageKey {
  if (error instanceof HostMutationError && error.code === "name-duplicate") {
    return "toast.hostMoveDuplicate";
  }
  if (error instanceof ProjectWriteError && error.code === "needs-sync") {
    return "toast.hostMoveNeedsSync";
  }
  return "toast.hostMoveFailed";
}

export function useHostActionsLogic() {
  const router = useRouter();
  const dispatch = useAppDispatch();
  const projects = useAppSelector((state) => state.projects.projects);
  const [menuHost, setMenuHost] = useState<MenuHost | null>(null);
  const [movePickerOpen, setMovePickerOpen] = useState(false);

  const closeAll = useCallback(() => {
    setMenuHost(null);
    setMovePickerOpen(false);
  }, []);

  const openMenu = useCallback((host: MenuHost) => setMenuHost(host), []);

  const connect = useCallback(() => {
    if (!menuHost) {
      return;
    }
    const { id, projectId } = menuHost;
    router.push({
      pathname: "/(tabs)/hosts/terminal",
      params: projectId ? { hostId: id, projectId } : { hostId: id },
    });
    closeAll();
  }, [router, menuHost, closeAll]);

  const edit = useCallback(() => {
    if (!menuHost) {
      return;
    }
    router.push({ pathname: "/(tabs)/hosts/edit", params: { hostId: menuHost.id } });
    closeAll();
  }, [router, menuHost, closeAll]);

  // Only keyed projects can be written to; awaiting-key projects can't accept a host.
  const keyedProjects = useMemo(() => projects.filter((p) => !p.awaiting), [projects]);
  const openMovePicker = useCallback(() => setMovePickerOpen(true), []);

  const move = useMutation({
    mutationFn: ({ hostId, projectId }: { hostId: string; projectId: string }) =>
      moveHostToProject(hostId, projectId),
    onSuccess: () => {
      dispatch(showToast({ messageKey: "toast.hostMoved", kind: "success" }));
      closeAll();
    },
    onError: (error) => dispatch(showToast({ messageKey: moveErrorToast(error), kind: "error" })),
  });

  const moveTo = useCallback(
    (projectId: string) => {
      if (menuHost) {
        move.mutate({ hostId: menuHost.id, projectId });
      }
    },
    [menuHost, move],
  );

  const deletion = useMutation({
    mutationFn: (hostId: string) => deleteHost(hostId),
    onSuccess: closeAll,
  });

  const confirmDelete = useCallback(
    (copy: DeleteConfirmCopy) => {
      if (!menuHost) {
        return;
      }
      const hostId = menuHost.id;
      Alert.alert(copy.title, copy.body, [
        { text: copy.cancel, style: "cancel" },
        { text: copy.confirm, style: "destructive", onPress: () => deletion.mutate(hostId) },
      ]);
    },
    [menuHost, deletion],
  );

  return {
    menuHost,
    actionsVisible: menuHost !== null && !movePickerOpen,
    moveVisible: movePickerOpen,
    keyedProjects,
    movingProjectId: move.isPending ? move.variables?.projectId : undefined,
    openMenu,
    closeAll,
    connect,
    edit,
    openMovePicker,
    moveTo,
    confirmDelete,
  };
}
