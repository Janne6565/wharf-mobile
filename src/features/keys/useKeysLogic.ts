// Keys tab is read-only in v1 (see PLAN.md / KEYSYNC.md): no keygen and no key
// deletion on mobile — view + use only. Two things are shown:
//   - Synced SSH keys: private keys the user opted to sync through the personal
//     vault (added with `s` on the TUI's Keys tab). They live in Redux as
//     non-secret metadata (`state.vault.keys` — the material is stripped); this
//     hook derives a per-key fingerprint from the public half for display.
//   - The account's project-encryption identity (the X25519 keypair used to
//     unwrap project DEKs) once bootstrapped — created date + a fingerprint of the
//     public half, with a copy button. The identity is NOT in Redux, so it is read
//     from the in-memory session payload on focus (no network), and shown once the
//     first Projects visit generates it.

import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { useCallback, useMemo, useState } from "react";
import { useAppDispatch, useAppSelector } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { parseVaultDocument } from "@/vault/document";
import { getVaultSession } from "@/vault/vaultSession";
import { identityFingerprint, sshFingerprint } from "./lib";

export interface KeyIdentity {
  readonly publicKey: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

// A synced SSH key row: metadata plus the derived OpenSSH fingerprint. The
// fingerprint is "" when the key has no stored public half (older TUI writes may
// omit it); the row then hides the fingerprint line and the copy action.
export interface SyncedKeyView {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly fingerprint: string;
  readonly publicKey?: string;
}

export function useKeysLogic() {
  const dispatch = useAppDispatch();
  const [identity, setIdentity] = useState<KeyIdentity | null>(null);
  const keys = useAppSelector((state) => state.vault.keys);
  const syncPhase = useAppSelector((state) => state.sync.phase);

  const syncedKeys = useMemo<SyncedKeyView[]>(
    () =>
      keys.map((key) => ({
        id: key.id,
        name: key.name,
        type: key.type,
        fingerprint: key.publicKey ? sshFingerprint(key.publicKey) : "",
        ...(key.publicKey ? { publicKey: key.publicKey } : {}),
      })),
    [keys],
  );

  // Re-read on every focus: the identity may be minted while the user is on the
  // Projects tab, so the Keys tab should reflect it the next time it is shown.
  useFocusEffect(
    useCallback(() => {
      const session = getVaultSession();
      const doc = session ? parseVaultDocument(session.payload) : undefined;
      if (doc?.identity) {
        setIdentity({
          publicKey: doc.identity.x25519Pub,
          fingerprint: identityFingerprint(doc.identity.x25519Pub),
          createdAt: doc.identity.createdAt,
        });
      } else {
        setIdentity(null);
      }
    }, []),
  );

  const copyPublicKey = useCallback(() => {
    if (!identity) {
      return;
    }
    void Clipboard.setStringAsync(identity.publicKey);
    dispatch(showToast({ messageKey: "toast.keyCopied", kind: "success" }));
  }, [identity, dispatch]);

  // Copy a synced key's authorized_keys line (only wired when publicKey exists).
  const copyKey = useCallback(
    (publicKey: string) => {
      void Clipboard.setStringAsync(publicKey);
      dispatch(showToast({ messageKey: "toast.keyCopied", kind: "success" }));
    },
    [dispatch],
  );

  // Keys + identity read instantly from the local vault; the async part is the
  // first personal sync possibly delivering a newer vault. Show a skeleton (not
  // the empty state) while nothing is on screen and that first pass is in flight.
  const showLoading = syncedKeys.length === 0 && !identity && syncPhase === "syncing";

  return { identity, syncedKeys, copyPublicKey, copyKey, showLoading };
}
