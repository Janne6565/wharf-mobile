// React Native primitive backend — the on-device half CI cannot run.
//
//   argon2id        → the local `wharf-argon2` Expo module (argon2kt on Android,
//                     Argon2Swift on iOS). It takes the secret and salt as raw
//                     bytes (base64 over the bridge) and honours parallelism = 4,
//                     which libsodium's crypto_pwhash CANNOT (its high-level API
//                     fixes the lane count) — the reason this module exists.
//   SHA-256 / HKDF  → @noble/hashes (pure JS, byte-identical to WebCrypto here;
//                     proven against the same pinned key-derivation vectors).
//   XChaCha20 / box → react-native-libsodium (JSI, libsodium-wrappers API).
//
// Metro resolves this file on device; Jest never loads it (it takes index.node).
// The verbatim crypto layer above depends only on the shared contract, so
// swapping this backend in changes nothing about wharfv/wharfp/x25519/keys.

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import sodium from "react-native-libsodium";
import { argon2idRaw } from "../../../modules/wharf-argon2";
import { fromBase64, toBase64 } from "../base64";
import type { Argon2Params, CryptoPrimitives, PrimitivesBackend } from "./types";

export type { Argon2Params } from "./types";

export const PRIMITIVES_BACKEND: PrimitivesBackend = "native";

const encoder = new TextEncoder();

// The native module speaks base64 (arbitrary bytes cross the bridge safely as
// base64; a UTF-8 string would corrupt a binary recovery secret).
export async function deriveArgon2id(
  secret: Uint8Array,
  salt: Uint8Array,
  params: Argon2Params,
): Promise<Uint8Array> {
  const rawBase64 = await argon2idRaw(
    toBase64(secret),
    toBase64(salt),
    params.iterations,
    params.memoryKiB,
    params.parallelism,
    32,
  );
  return fromBase64(rawBase64);
}

export async function sha256(data: Uint8Array): Promise<Uint8Array> {
  return nobleSha256(data);
}

// Empty salt matches the WebCrypto HKDF the Node backend uses: an empty salt
// makes the HMAC key HashLen zero bytes, which @noble reproduces exactly.
export async function hkdfSha256(ikm: Uint8Array, info: string, length = 32): Promise<Uint8Array> {
  return hkdf(nobleSha256, ikm, new Uint8Array(0), encoder.encode(info), length);
}

let sodiumReady: Promise<typeof sodium> | null = null;

async function ready(): Promise<typeof sodium> {
  if (!sodiumReady) {
    sodiumReady = sodium.ready.then(() => sodium);
  }
  return sodiumReady;
}

export async function xchachaSeal(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array | null,
): Promise<Uint8Array> {
  const s = await ready();
  return s.crypto_aead_xchacha20poly1305_ietf_encrypt(plaintext, aad, null, nonce, key);
}

export async function xchachaOpen(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array | null,
): Promise<Uint8Array | null> {
  const s = await ready();
  try {
    return s.crypto_aead_xchacha20poly1305_ietf_decrypt(null, ciphertext, aad, nonce, key);
  } catch {
    return null;
  }
}

export function randomBytes(length: number): Uint8Array {
  // sodium.ready has resolved by the time any crypto flow reaches this (unlock
  // always derives a KEK via libsodium first); randombytes_buf is synchronous.
  return sodium.randombytes_buf(length);
}

export async function boxKeypair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  const s = await ready();
  const kp = s.crypto_box_keypair();
  return { publicKey: kp.publicKey, privateKey: kp.privateKey };
}

export async function boxSeal(message: Uint8Array, recipientPub: Uint8Array): Promise<Uint8Array> {
  const s = await ready();
  return s.crypto_box_seal(message, recipientPub);
}

export async function boxSealOpen(
  sealed: Uint8Array,
  publicKey: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array | null> {
  const s = await ready();
  try {
    return s.crypto_box_seal_open(sealed, publicKey, privateKey);
  } catch {
    return null;
  }
}

// Compile-time proof that this backend satisfies the shared contract.
const _contract: CryptoPrimitives = {
  deriveArgon2id,
  sha256,
  hkdfSha256,
  xchachaSeal,
  xchachaOpen,
  randomBytes,
  boxKeypair,
  boxSeal,
  boxSealOpen,
};
void _contract;
