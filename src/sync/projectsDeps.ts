// The concrete ProjectSyncDeps: the bridge between the pure project engine
// (projects.ts) and the app's API client, on-device blob cache, and crypto. Built
// per pass from the resolved account identity (projectsEngine.ts calls
// makeProjectSyncDeps once ensureIdentity has produced the keypair), so the
// engine's DEK-unwrap dep closes over the caller's private key without the engine
// ever seeing it.
//
// Statelessness (TUI parity): the wrapped DEK is fetched fresh on every pass and
// unwrapped each time — we never cache an unwrapped DEK, so a rotated key is
// handled transparently (the new wrapped DEK just opens, or, if we are not yet
// re-keyed, does not → awaiting access).

import type { MyInvite } from "@/api/generated/model";
import { getHttpStatus } from "@/api/httpError";
import { getMyInvites, getProjectVault, listProjects } from "@/api/wharf";
import { fromBase64, openDek, openProject } from "@/crypto";
import type { IdentityKeys } from "@/vault/identity";
import type { ProjectMetaEntry } from "@/vault/storage";
import {
  deleteProjectBlob,
  deleteProjectMeta,
  readProjectBlob,
  readProjectMeta,
  upsertProjectMeta,
  writeProjectBlob,
} from "@/vault/storage";
import type { InviteView, ProjectSyncDeps, RemoteProjectVault } from "./projectTypes";

const HTTP_NOT_FOUND = 404;

function toInviteView(invite: MyInvite): InviteView {
  return {
    id: invite.id ?? "",
    projectId: invite.projectId ?? "",
    projectName: invite.projectName ?? "",
    invitedByEmail: invite.invitedByEmail ?? "",
  };
}

// makeProjectSyncDeps binds the pure engine's collaborators to the real API /
// storage / crypto, closing over the caller's X25519 identity for DEK unwrapping.
export function makeProjectSyncDeps(identity: IdentityKeys): ProjectSyncDeps {
  const unwrap = async (wrappedDek: Uint8Array): Promise<Uint8Array | null> => {
    try {
      return await openDek(wrappedDek, identity.publicKey, identity.privateKey);
    } catch {
      // Sealed to a key our current identity cannot open (rotated / foreign): the
      // caller treats this as awaiting access rather than an error.
      return null;
    }
  };

  const openBlob = async (dek: Uint8Array, blob: Uint8Array): Promise<Uint8Array | null> => {
    try {
      return await openProject(dek, blob);
    } catch {
      return null;
    }
  };

  return {
    listProjects: async () => await listProjects(),

    fetchInvites: async () => (await getMyInvites()).map(toInviteView),

    loadMeta: () => readProjectMeta(),

    fetchVault: async (id: string): Promise<RemoteProjectVault> => {
      try {
        const res = await getProjectVault(id);
        return {
          status: "present",
          blob: res.vault ? fromBase64(res.vault) : null,
          version: res.version ?? 0,
          wrappedDek: res.wrappedDek ? fromBase64(res.wrappedDek) : null,
        };
      } catch (error) {
        if (getHttpStatus(error) === HTTP_NOT_FOUND) {
          return { status: "not-found" };
        }
        throw error;
      }
    },

    openDek: unwrap,
    openBlob,

    cacheProject: async (id, entry, blob) => {
      writeProjectBlob(id, blob);
      await upsertProjectMeta(id, entry);
    },

    dropProject: async (id) => {
      deleteProjectBlob(id);
      await deleteProjectMeta(id);
    },

    loadCached: async (id: string, entry: ProjectMetaEntry): Promise<Uint8Array | null> => {
      const dek = await unwrap(fromBase64(entry.wrappedDek));
      if (!dek) {
        return null;
      }
      const blob = await readProjectBlob(id);
      return blob ? openBlob(dek, blob) : null;
    },
  };
}
