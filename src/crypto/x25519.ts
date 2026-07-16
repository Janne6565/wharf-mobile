// X25519 sealed-box wrapping of a project DEK — a byte-for-byte TypeScript port
// of wharf-tui's internal/vault/box.go, built on libsodium's crypto_box_seal /
// crypto_box_seal_open (the same primitives Go's nacl/box uses). A project DEK
// is shared with a recipient by sealing it to their X25519 public key: the
// sender needs no long-term key (an ephemeral keypair is used per seal), and
// only the recipient's private key can open it. Proven wire-compatible with the
// Go client by the project-fixture byte-compat test.

import { corrupt, wrongSecret } from "./errors";
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

// sealDek seals the 32-byte project DEK to recipientPub, returning exactly
// WRAPPED_DEK_LEN (80) bytes. crypto_box_seal compatible.
export async function sealDek(dek: Uint8Array, recipientPub: Uint8Array): Promise<Uint8Array> {
  if (dek.length !== DEK_LEN) {
    throw corrupt();
  }
  if (recipientPub.length !== X25519_KEY_LEN) {
    throw corrupt();
  }
  return boxSeal(dek, recipientPub);
}

// openDek opens a sealed project DEK with the recipient's keypair. A failure to
// open (wrong recipient or tampering — indistinguishable) throws the module's
// wrong-secret CryptoError, matching the vault's wrap-open discipline.
export async function openDek(
  wrapped: Uint8Array,
  pub: Uint8Array,
  priv: Uint8Array,
): Promise<Uint8Array> {
  if (pub.length !== X25519_KEY_LEN || priv.length !== X25519_KEY_LEN) {
    throw corrupt();
  }
  if (wrapped.length !== WRAPPED_DEK_LEN) {
    throw corrupt();
  }
  const dek = await boxSealOpen(wrapped, pub, priv);
  if (!dek) {
    throw wrongSecret();
  }
  return dek;
}
