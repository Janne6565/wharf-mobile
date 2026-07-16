// React Native primitive backend — the on-device half CI cannot run.
//
//   argon2id        → the local `wharf-argon2` Expo module (argon2kt on Android,
//                     Argon2Swift on iOS). It takes the secret and salt as raw
//                     bytes (base64 over the bridge) and honours parallelism = 4,
//                     which libsodium's crypto_pwhash CANNOT (its high-level API
//                     fixes the lane count) — the reason this module exists.
//   SHA-256 / HKDF  → @noble/hashes (pure JS, byte-identical to WebCrypto here;
//                     proven against the same pinned key-derivation vectors).
//   XChaCha20 / box → the pure-JS @noble backend in ./nobleSodium (byte-identical
//                     to libsodium; proven against libsodium-wrappers in CI).
//   randombytes     → react-native-libsodium's JSI CSPRNG (synchronous).
//
// Why NOT react-native-libsodium for XChaCha / the sealed box: its JSI AEAD reads
// additional-data ONLY as a JS string and feeds that string's UTF-8 bytes to
// libsodium as the AAD (cpp: `arguments[1].asString(runtime).utf8(runtime)` →
// `additionalData.data()/.length()`). The WHARFV/WHARFP formats bind the RAW binary
// header as AAD, which is not valid UTF-8 and cannot survive a JS-string round-trip
// — so every seal/open threw "input type not yet implemented" (Uint8Array/null AAD)
// or would corrupt the AAD. ./nobleSodium takes binary AAD directly. Only the RNG
// still crosses the JSI bridge, where no binary-AAD marshalling is involved.
//
// Metro resolves this file on device; Jest never loads it (it takes index.node).
// The verbatim crypto layer above depends only on the shared contract, so
// swapping this backend in changes nothing about wharfv/wharfp/x25519/keys.

import { hkdf } from "@noble/hashes/hkdf.js";
import { sha256 as nobleSha256 } from "@noble/hashes/sha2.js";
import sodium from "react-native-libsodium";
import { argon2idRaw } from "../../../modules/wharf-argon2";
import { fromBase64, toBase64 } from "../base64";
import {
  boxKeypairNoble,
  boxSealNoble,
  boxSealOpenNoble,
  xchachaOpenNoble,
  xchachaSealNoble,
} from "./nobleSodium";
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

export async function xchachaSeal(
  key: Uint8Array,
  nonce: Uint8Array,
  plaintext: Uint8Array,
  aad: Uint8Array | null,
): Promise<Uint8Array> {
  return xchachaSealNoble(key, nonce, plaintext, aad);
}

export async function xchachaOpen(
  key: Uint8Array,
  nonce: Uint8Array,
  ciphertext: Uint8Array,
  aad: Uint8Array | null,
): Promise<Uint8Array | null> {
  return xchachaOpenNoble(key, nonce, ciphertext, aad);
}

export function randomBytes(length: number): Uint8Array {
  // sodium.ready has resolved by the time any crypto flow reaches this (unlock
  // always derives a KEK first); randombytes_buf is a synchronous JSI CSPRNG and
  // needs none of the binary-AAD marshalling that ruled libsodium out above.
  return sodium.randombytes_buf(length);
}

export async function boxKeypair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }> {
  return boxKeypairNoble(randomBytes);
}

export async function boxSeal(message: Uint8Array, recipientPub: Uint8Array): Promise<Uint8Array> {
  return boxSealNoble(message, recipientPub, randomBytes);
}

export async function boxSealOpen(
  sealed: Uint8Array,
  _publicKey: Uint8Array,
  privateKey: Uint8Array,
): Promise<Uint8Array | null> {
  return boxSealOpenNoble(sealed, privateKey);
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
