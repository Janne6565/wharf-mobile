// The concrete FinalizeDeps: the bridge between the pure finalize pass
// (finalize.ts) and the app's API client + crypto. Built per pass from the
// resolved account identity (projectsEngine.ts calls makeFinalizeDeps once
// ensureIdentity has produced the keypair), so the DEK-unwrap dep closes over the
// caller's private key without the engine ever seeing it.
//
// Statelessness (TUI parity): the wrapped DEK is fetched fresh and unwrapped each
// pass — never cached — and the seal is bound to the vault version it was wrapped
// against, so a concurrent rotation is refused (409) rather than silently
// applied. The base64 ⇄ bytes conversions live here; the engine works in bytes.

import { getHttpStatus } from "@/api/httpError";
import { getPendingKeys, getProjectVault, submitMemberKey } from "@/api/wharf";
import { fromBase64, openDek, sealDek, toBase64 } from "@/crypto";
import type { IdentityKeys } from "@/vault/identity";
import type { FinalizeDeps, PendingMember, RemoteProjectVault } from "./projectTypes";

const HTTP_NOT_FOUND = 404;

// makeFinalizeDeps binds the finalize engine's collaborators to the real API /
// crypto, closing over the caller's X25519 identity for DEK unwrapping + sealing.
export function makeFinalizeDeps(identity: IdentityKeys): FinalizeDeps {
  return {
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

    openDek: async (wrappedDek: Uint8Array): Promise<Uint8Array | null> => {
      try {
        return await openDek(wrappedDek, identity.publicKey, identity.privateKey);
      } catch {
        // Sealed to a key our current identity cannot open (rotated / not keyed
        // yet): treat as "cannot finalize this project", not an error.
        return null;
      }
    },

    getPendingKeys: async (id: string): Promise<readonly PendingMember[]> => {
      const pending = await getPendingKeys(id);
      return pending
        .filter((m): m is { userId: string; publicKey: string } => Boolean(m.userId && m.publicKey))
        .map((m) => ({ userId: m.userId, publicKey: fromBase64(m.publicKey) }));
    },

    sealDek: (dek: Uint8Array, memberPublicKey: Uint8Array) => sealDek(dek, memberPublicKey),

    submitMemberKey: async (id, userId, wrappedDek, vaultVersion) => {
      await submitMemberKey(id, userId, { wrappedDek: toBase64(wrappedDek), vaultVersion });
    },
  };
}
