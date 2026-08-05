// Hybrid post-quantum wrapping of a project DEK — a byte-for-byte TypeScript
// port of wharf-tui's internal/vault/hybrid.go (and identical to wharf-web's
// src/crypto/hybrid.ts), proven against Go by the project fixture's hybrid*
// fields.
//
// ML-KEM comes from @noble/post-quantum: pure JS, so it works on device without
// a native module — the same reasoning that put @noble behind the rest of the
// mobile crypto layer.
//
// A v1 identity is a bare X25519 keypair and a v1 wrapped DEK is a bare 80-byte
// sealed box (see x25519.ts). Both are classical: the server stores wrapped DEKs
// forever, so an attacker who records them today decrypts them once a quantum
// computer exists. v2 adds ML-KEM-768 (FIPS 203) *around* the existing sealed
// box rather than replacing it:
//
//   v2 identity pub  = 0x02 || X25519 pub (32) || ML-KEM-768 ek (1184)
//   v2 identity priv = 0x02 || X25519 priv (32) || ML-KEM-768 seed (64)
//   v2 wrapped DEK   = 0x02 || ML-KEM ct (1088) || nonce (24) ||
//                      XChaCha20-Poly1305(key = HKDF(ss), aad = 0x02 || ct,
//                                         plaintext = v1 sealed box (80))
//
// Opening a v2 blob needs the ML-KEM decapsulation key AND the X25519 private
// key, so it stays secure if either primitive survives, and the inner 80 bytes
// are unchanged from v1.
//
// The ML-KEM private half is stored as its 64-byte FIPS 203 (d, z) seed and
// expanded on use; Go's crypto/mlkem and @noble/post-quantum expand the same
// seed to the same keypair (asserted in hybrid.test.ts).

import { ml_kem768 } from "@noble/post-quantum/ml-kem.js";

import { corrupt, wrongSecret } from "./errors";
import { hkdfSha256, randomBytes, xchachaOpen, xchachaSeal } from "./primitives";
import { X25519_KEY_LEN } from "./x25519";

// The version byte prefixing every v2 identity key and wrapped DEK. v1 values
// carry no prefix and are recognised by their exact length.
export const IDENTITY_V2 = 0x02;

const MLKEM_SEED_LEN = 64;
const MLKEM_EK_LEN = 1184;
const MLKEM_CT_LEN = 1088;
const NONCE_LEN = 24;
const AEAD_TAG_LEN = 16;
const WRAPPED_DEK_LEN_V1 = 80;

export const HYBRID_PUB_LEN = 1 + X25519_KEY_LEN + MLKEM_EK_LEN;
export const HYBRID_PRIV_LEN = 1 + X25519_KEY_LEN + MLKEM_SEED_LEN;
export const HYBRID_WRAPPED_DEK_LEN =
  1 + MLKEM_CT_LEN + NONCE_LEN + WRAPPED_DEK_LEN_V1 + AEAD_TAG_LEN;

// Domain-separates the HKDF that turns the ML-KEM shared secret into the outer
// AEAD key. Must match dekWrapInfo in hybrid.go.
const DEK_WRAP_INFO = "wharf/dek-wrap/v2";

export function isHybridPub(pub: Uint8Array): boolean {
  return pub.length === HYBRID_PUB_LEN && pub[0] === IDENTITY_V2;
}

export function isHybridPriv(priv: Uint8Array): boolean {
  return priv.length === HYBRID_PRIV_LEN && priv[0] === IDENTITY_V2;
}

export function isHybridWrapped(wrapped: Uint8Array): boolean {
  return wrapped.length === HYBRID_WRAPPED_DEK_LEN && wrapped[0] === IDENTITY_V2;
}

// isIdentityPub reports whether bytes are a well-formed identity public key of
// either version — the check applied to a key the *server* hands out, where
// anything else is garbage rather than someone's key.
export function isIdentityPub(pub: Uint8Array): boolean {
  return pub.length === X25519_KEY_LEN || isHybridPub(pub);
}

// newMlkemSeed generates the 64-byte FIPS 203 seed of a fresh ML-KEM-768
// keypair. The seed — not the expanded secret key — is what the vault stores,
// so every client derives the same keypair from the same bytes.
export function newMlkemSeed(): Uint8Array {
  return randomBytes(MLKEM_SEED_LEN);
}

function concat(...parts: readonly Uint8Array[]): Uint8Array {
  const out = new Uint8Array(parts.reduce((n, p) => n + p.length, 0));
  let at = 0;
  for (const part of parts) {
    out.set(part, at);
    at += part.length;
  }
  return out;
}

// encodeIdentity assembles the wire forms of an identity from its stored parts.
// An empty seed yields the v1 forms (the bare X25519 keys), so a vault written
// before the hybrid upgrade round-trips unchanged.
export function encodeIdentity(
  x25519Pub: Uint8Array,
  x25519Priv: Uint8Array,
  mlkemSeed?: Uint8Array,
): { publicKey: Uint8Array; privateKey: Uint8Array } {
  if (x25519Pub.length !== X25519_KEY_LEN || x25519Priv.length !== X25519_KEY_LEN) {
    throw corrupt();
  }
  if (!mlkemSeed || mlkemSeed.length === 0) {
    return { publicKey: x25519Pub.slice(), privateKey: x25519Priv.slice() };
  }
  if (mlkemSeed.length !== MLKEM_SEED_LEN) {
    throw corrupt();
  }
  const { publicKey: ek } = ml_kem768.keygen(mlkemSeed);
  return {
    publicKey: concat(Uint8Array.of(IDENTITY_V2), x25519Pub, ek),
    privateKey: concat(Uint8Array.of(IDENTITY_V2), x25519Priv, mlkemSeed),
  };
}

// splitPub returns the X25519 half of an identity public key and, for v2, its
// ML-KEM encapsulation key.
export function splitPub(pub: Uint8Array): { x25519: Uint8Array; ek?: Uint8Array } {
  if (pub.length === X25519_KEY_LEN) return { x25519: pub };
  if (isHybridPub(pub)) {
    return {
      x25519: pub.subarray(1, 1 + X25519_KEY_LEN),
      ek: pub.subarray(1 + X25519_KEY_LEN),
    };
  }
  throw corrupt();
}

// splitPriv returns the X25519 half of an identity private key and, for v2, its
// ML-KEM seed.
export function splitPriv(priv: Uint8Array): { x25519: Uint8Array; mlkemSeed?: Uint8Array } {
  if (priv.length === X25519_KEY_LEN) return { x25519: priv };
  if (isHybridPriv(priv)) {
    return {
      x25519: priv.subarray(1, 1 + X25519_KEY_LEN),
      mlkemSeed: priv.subarray(1 + X25519_KEY_LEN),
    };
  }
  throw corrupt();
}

// wrapHybrid seals an already-sealed (v1) DEK under a fresh ML-KEM-768
// encapsulation to ek.
export async function wrapHybrid(inner: Uint8Array, ek: Uint8Array): Promise<Uint8Array> {
  const { cipherText, sharedSecret } = ml_kem768.encapsulate(ek);
  const key = await hkdfSha256(sharedSecret, DEK_WRAP_INFO);
  const nonce = randomBytes(NONCE_LEN);
  // AAD binds the ciphertext to the encapsulation it was derived from, so an
  // ML-KEM ciphertext cannot be swapped between two wrapped DEKs.
  const aad = concat(Uint8Array.of(IDENTITY_V2), cipherText);
  const body = await xchachaSeal(key, nonce, inner, aad);
  return concat(aad, nonce, body);
}

// unwrapHybrid strips the ML-KEM layer, returning the inner v1 sealed box.
export async function unwrapHybrid(
  wrapped: Uint8Array,
  mlkemSeed?: Uint8Array,
): Promise<Uint8Array> {
  // A v2 blob against a v1 identity: the recipient simply cannot open it.
  if (!mlkemSeed) throw wrongSecret();

  const aad = wrapped.subarray(0, 1 + MLKEM_CT_LEN);
  const cipherText = wrapped.subarray(1, 1 + MLKEM_CT_LEN);
  const nonce = wrapped.subarray(1 + MLKEM_CT_LEN, 1 + MLKEM_CT_LEN + NONCE_LEN);
  const body = wrapped.subarray(1 + MLKEM_CT_LEN + NONCE_LEN);

  let sharedSecret: Uint8Array;
  try {
    const { secretKey } = ml_kem768.keygen(mlkemSeed);
    sharedSecret = ml_kem768.decapsulate(cipherText, secretKey);
  } catch {
    throw wrongSecret();
  }
  const key = await hkdfSha256(sharedSecret, DEK_WRAP_INFO);
  const inner = await xchachaOpen(key, nonce, body, aad);
  if (!inner) throw wrongSecret();
  return inner;
}
