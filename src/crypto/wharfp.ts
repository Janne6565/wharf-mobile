// WHARFP project-blob format — a byte-for-byte TypeScript port of wharf-tui's
// internal/vault/project.go. A blob created here is openable by the Go client
// and vice-versa (proven by the project byte-compat fixture test). Unlike
// WHARFV, WHARFP carries no key slots: the project DEK is delivered out of band
// (wrapped per-recipient by the sealed-box scheme in x25519.ts).
//
// Blob layout (v1, little-endian):
//   off  len  field
//   0    6    magic "WHARFP"
//   6    2    version uint16 = 1
//   8    24   body nonce (XChaCha20-Poly1305)
//   32   ...  XChaCha20-Poly1305(bodyNonce, projectDEK, payload, AAD = bytes[0:32])

import { corrupt } from "./errors";
import { randomBytes, xchachaOpen, xchachaSeal } from "./primitives";

const MAGIC = "WHARFP";
const FILE_VERSION = 1;

const BODY_NONCE_LEN = 24;
const DEK_LEN = 32;
export const HEADER_LEN = 32;

const OFF_VERSION = 6;
const OFF_BODY_NONCE = 8;

const textEncoder = new TextEncoder();

// marshalHeader builds the fixed 32-byte prefix (magic + version + body nonce),
// which is both the sealed body's AAD and the blob header.
function marshalHeader(bodyNonce: Uint8Array): Uint8Array {
  const b = new Uint8Array(HEADER_LEN);
  const view = new DataView(b.buffer);
  b.set(textEncoder.encode(MAGIC), 0);
  view.setUint16(OFF_VERSION, FILE_VERSION, true);
  b.set(bodyNonce, OFF_BODY_NONCE);
  return b;
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// sealProject seals payload under the project DEK, binding the header as AAD. A
// fresh random nonce is drawn on every call, so the same (dek, payload) never
// produces the same blob twice.
export async function sealProject(dek: Uint8Array, payload: Uint8Array): Promise<Uint8Array> {
  if (dek.length !== DEK_LEN) {
    throw corrupt();
  }
  const bodyNonce = randomBytes(BODY_NONCE_LEN);
  const header = marshalHeader(bodyNonce);
  const body = await xchachaSeal(dek, bodyNonce, payload, header);
  return concat(header, body);
}

// openProject reverses sealProject. It strictly validates the magic, version and
// length before decrypting; any structural problem, and any AEAD failure (wrong
// DEK or tampering — indistinguishable), maps to a corrupt error, matching the
// Go OpenProject discipline.
export async function openProject(dek: Uint8Array, blob: Uint8Array): Promise<Uint8Array> {
  if (dek.length !== DEK_LEN) {
    throw corrupt();
  }
  if (blob.length < HEADER_LEN) {
    throw corrupt();
  }
  const magic = new TextDecoder().decode(blob.subarray(0, OFF_VERSION));
  if (magic !== MAGIC) {
    throw corrupt();
  }
  const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
  if (view.getUint16(OFF_VERSION, true) !== FILE_VERSION) {
    throw corrupt();
  }
  const bodyNonce = blob.slice(OFF_BODY_NONCE, HEADER_LEN);
  const body = blob.slice(HEADER_LEN);
  const aad = blob.slice(0, HEADER_LEN);
  const payload = await xchachaOpen(dek, bodyNonce, body, aad);
  if (!payload) {
    throw corrupt();
  }
  return payload;
}
