// Pure-JS libsodium-compatible primitives (XChaCha20-Poly1305 AEAD + the X25519
// sealed box), built on @noble/ciphers + @noble/curves. This module deliberately
// imports NO native code, so it runs identically under Hermes (device) and Node
// (Jest) — which lets primitives/native-parity.test.ts prove it byte-identical to
// libsodium-wrappers in CI, closing the gap that the on-device JSI path cannot.
//
// It exists because react-native-libsodium's JSI cannot carry the binary AAD the
// WHARFV/WHARFP formats require (its AEAD reads additional-data as a UTF-8 string
// and feeds that string's UTF-8 bytes to libsodium — the raw binary header is not
// valid UTF-8, so it threw "input type not yet implemented" or corrupted the AAD).
// @noble takes binary AAD directly. See index.native.ts for the wiring.
//
// The RNG is injected (never imported) so the caller supplies the platform CSPRNG
// and this module stays free of any native dependency.

import { xchacha20poly1305 } from "@noble/ciphers/chacha.js";
import { hsalsa, secretbox } from "@noble/ciphers/salsa.js";
import { x25519 } from "@noble/curves/ed25519.js";
import { blake2b } from "@noble/hashes/blake2.js";
import { isAeadAuthFailure } from "./aeadError";

export type RandomBytes = (length: number) => Uint8Array;

export const X25519_PUBLICKEY_BYTES = 32;
const X25519_SECRETKEY_BYTES = 32;
const SEAL_NONCE_BYTES = 24;
const HSALSA_NONCE_WORDS = 4; // 16-byte zero nonce prefix

const encoder = new TextEncoder();

export function xchachaSealNoble(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array | null,
): Uint8Array {
  // A null AAD is byte-identical to an empty AAD (adlen 0) in libsodium; @noble
  // treats an undefined AAD the same way.
  return xchacha20poly1305(key, nonce, aad ?? undefined).encrypt(plaintext);
}

export function xchachaOpenNoble(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array | null,
): Uint8Array | null {
  try {
    return xchacha20poly1305(key, nonce, aad ?? undefined).decrypt(ciphertext);
  } catch (err) {
    // Only a genuine authentication failure (wrong key or tampering) flattens to
    // the null the vault layer reads as wrong-secret/corrupt; anything else (a
    // wrong-length key, an unexpected fault) surfaces with its real message.
    if (isAeadAuthFailure(err)) {
      return null;
    }
    throw err;
  }
}

// libsodium's crypto_box_keypair is a random 32-byte X25519 secret key plus its
// scalarmult-base public key (secret stored unclamped; clamping happens inside
// scalarmult). @noble's x25519 matches byte-for-byte.
export function boxKeypairNoble(random: RandomBytes): {
  publicKey: Uint8Array;
  privateKey: Uint8Array;
} {
  const privateKey = random(X25519_SECRETKEY_BYTES);
  return { publicKey: x25519.getPublicKey(privateKey), privateKey };
}

// crypto_box_seal(m, pk):
//   epk, esk = ephemeral X25519 keypair
//   nonce    = blake2b(epk ‖ pk, 24)
//   k        = HSalsa20(sigma, X25519(esk, pk), 0)   (crypto_box_beforenm)
//   output   = epk ‖ XSalsa20-Poly1305(k, nonce).seal(m)   (crypto_secretbox)
export function boxSealNoble(
  message: Uint8Array,
  recipientPub: Uint8Array,
  random: RandomBytes,
): Uint8Array {
  const ephemeralSecret = random(X25519_SECRETKEY_BYTES);
  const ephemeralPublic = x25519.getPublicKey(ephemeralSecret);
  const nonce = sealNonce(ephemeralPublic, recipientPub);
  const key = boxBeforeNm(recipientPub, ephemeralSecret);
  const body = secretbox(key, nonce).seal(message);
  const out = new Uint8Array(ephemeralPublic.length + body.length);
  out.set(ephemeralPublic, 0);
  out.set(body, ephemeralPublic.length);
  return out;
}

// crypto_box_seal_open needs only the recipient private key: the sender's
// ephemeral public key is carried in the sealed box, and the recipient public key
// (for the nonce) is derived from the private key — matching libsodium, which uses
// its pk argument solely for that nonce.
export function boxSealOpenNoble(sealed: Uint8Array, privateKey: Uint8Array): Uint8Array | null {
  const ephemeralPublic = sealed.slice(0, X25519_PUBLICKEY_BYTES);
  const body = sealed.slice(X25519_PUBLICKEY_BYTES);
  const recipientPublic = x25519.getPublicKey(privateKey);
  const nonce = sealNonce(ephemeralPublic, recipientPublic);
  const key = boxBeforeNm(ephemeralPublic, privateKey);
  try {
    return secretbox(key, nonce).open(body);
  } catch (err) {
    if (isAeadAuthFailure(err)) {
      return null;
    }
    throw err;
  }
}

// "expand 32-byte k" as four little-endian 32-bit words — the sigma constant
// libsodium's crypto_box_beforenm feeds to crypto_core_hsalsa20.
const SIGMA_WORDS = bytesToWordsLE(encoder.encode("expand 32-byte k"));

function sealNonce(ephemeralPublic: Uint8Array, recipientPublic: Uint8Array): Uint8Array {
  const input = new Uint8Array(ephemeralPublic.length + recipientPublic.length);
  input.set(ephemeralPublic, 0);
  input.set(recipientPublic, ephemeralPublic.length);
  return blake2b(input, { dkLen: SEAL_NONCE_BYTES });
}

// crypto_box_beforenm: hash the raw X25519 shared point through HSalsa20 with a
// zero nonce prefix to derive the secretbox key, exactly as NaCl/libsodium.
function boxBeforeNm(theirPublic: Uint8Array, ourSecret: Uint8Array): Uint8Array {
  const shared = x25519.getSharedSecret(ourSecret, theirPublic);
  const out = new Uint32Array(8);
  hsalsa(SIGMA_WORDS, bytesToWordsLE(shared), new Uint32Array(HSALSA_NONCE_WORDS), out);
  return wordsToBytesLE(out);
}

function bytesToWordsLE(bytes: Uint8Array): Uint32Array {
  const view = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const words = new Uint32Array(bytes.byteLength / 4);
  for (let i = 0; i < words.length; i++) {
    words[i] = view.getUint32(i * 4, true);
  }
  return words;
}

function wordsToBytesLE(words: Uint32Array): Uint8Array {
  const bytes = new Uint8Array(words.length * 4);
  const view = new DataView(bytes.buffer);
  for (let i = 0; i < words.length; i++) {
    view.setUint32(i * 4, words[i], true);
  }
  return bytes;
}
