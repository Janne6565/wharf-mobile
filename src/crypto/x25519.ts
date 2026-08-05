// X25519 sealed-box wrapping of a project DEK — a byte-for-byte TypeScript port
// of wharf-tui's internal/vault/box.go, built on libsodium's crypto_box_seal /
// crypto_box_seal_open (the same primitives Go's nacl/box uses). A project DEK
// is shared with a recipient by sealing it to their X25519 public key: the
// sender needs no long-term key (an ephemeral keypair is used per seal), and
// only the recipient's private key can open it. Proven wire-compatible with the
// Go client by the project-fixture byte-compat test.

import { corrupt, wrongSecret } from "./errors";
import { isHybridWrapped, splitPriv, splitPub, unwrapHybrid, wrapHybrid } from "./hybrid";
import { boxKeypair, boxSeal, boxSealOpen } from "./primitives";

export const X25519_KEY_LEN = 32;
const DEK_LEN = 32;
const BOX_OVERHEAD = 16; // Poly1305 tag
// A sealed DEK: 32 ephemeral pk + 32 DEK + 16 tag.
export const WRAPPED_DEK_LEN = X25519_KEY_LEN + DEK_LEN + BOX_OVERHEAD;

// generateKeypair creates a fresh X25519 keypair (crypto_box_keypair). The
// private key stays inside the owner's personal vault; the public key is
// published so others can wrap project DEKs to it.
export async function generateKeypair(): Promise<{
  publicKey: Uint8Array;
  privateKey: Uint8Array;
}> {
  return boxKeypair();
}

// sealDek seals the 32-byte project DEK to recipientPub. Against a v1 (bare
// X25519) recipient it returns exactly WRAPPED_DEK_LEN (80) bytes,
// crypto_box_seal compatible. Against a v2 recipient the sealed box is wrapped
// again under a fresh ML-KEM-768 encapsulation (see hybrid.ts).
//
// The version follows the *recipient*, never a local preference: an upgraded
// client must still be able to key a member who has not upgraded yet.
export async function sealDek(dek: Uint8Array, recipientPub: Uint8Array): Promise<Uint8Array> {
  if (dek.length !== DEK_LEN) {
    throw corrupt();
  }
  const { x25519, ek } = splitPub(recipientPub);
  const sealed = await boxSeal(dek, x25519);
  return ek ? wrapHybrid(sealed, ek) : sealed;
}

// openDek opens a sealed project DEK with the recipient's keypair. A failure to
// open (wrong recipient or tampering — indistinguishable) throws the module's
// wrong-secret CryptoError, matching the vault's wrap-open discipline.
//
// Both versions are accepted independently of the identity's own version: a v2
// identity keeps its X25519 half, so every DEK sealed to it before the upgrade
// still opens.
export async function openDek(
  wrapped: Uint8Array,
  pub: Uint8Array,
  priv: Uint8Array,
): Promise<Uint8Array> {
  const { x25519: pubX } = splitPub(pub);
  const { x25519: privX, mlkemSeed } = splitPriv(priv);
  let sealed = wrapped;
  if (isHybridWrapped(wrapped)) {
    sealed = await unwrapHybrid(wrapped, mlkemSeed);
  } else if (wrapped.length !== WRAPPED_DEK_LEN) {
    throw corrupt();
  }
  const dek = await boxSealOpen(sealed, pubX, privX);
  if (!dek) {
    throw wrongSecret();
  }
  return dek;
}
