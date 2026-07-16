// Keys tab is read-only in v1 (see PLAN.md): the SSH keys themselves never leave
// the device and are managed in the terminal app. What mobile CAN show is the
// account's project-encryption identity (the X25519 keypair used to unwrap project
// DEKs) once it has been bootstrapped — created date + a fingerprint of the public
// half, with a copy button. The identity lives inside the unlocked personal vault
// payload, so this hook reads it from the in-memory session on focus (no network),
// and shows the empty state until the first Projects visit generates it.

import * as Clipboard from "expo-clipboard";
import { useFocusEffect } from "expo-router";
import { useCallback, useState } from "react";
import { useAppDispatch } from "@/store/hooks";
import { showToast } from "@/store/toastSlice";
import { parseVaultDocument } from "@/vault/document";
import { getVaultSession } from "@/vault/vaultSession";
import { identityFingerprint } from "./lib";

export interface KeyIdentity {
  readonly publicKey: string;
  readonly fingerprint: string;
  readonly createdAt: string;
}

export function useKeysLogic() {
  const dispatch = useAppDispatch();
  const [identity, setIdentity] = useState<KeyIdentity | null>(null);

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

  return { identity, copyPublicKey };
}
