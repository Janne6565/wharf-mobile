// Mobile-only extension to the WHARFV vault format. This file is deliberately
// NOT part of the byte-identical port set (wharfv.ts, wharfp.ts, x25519.ts,
// keys.ts, crockford.ts, base64.ts, payload.ts) — those stay verbatim copies of
// wharf-web/wharf-tui. This helper exists solely for the mobile biometric-gated
// cached-DEK unlock path (M2, PLAN §B): given a 32-byte DEK recovered from a
// `requireAuthentication` SecureStore entry, open a blob's body directly, so a
// biometric unlock never has to run argon2 to re-derive a KEK.
//
// It performs exactly the same body-open step wharfv's private `unlock` does
// after it has the DEK: the body nonce is the last 24 bytes of the AAD-covered
// header, and the body is XChaCha20-Poly1305 sealed under the DEK with the full
// header (bytes[0:HEADER_LEN]) as AAD. It only ever READS the on-disk format and
// never writes it, so it cannot desync the byte-compatible files.

import { corrupt, wrongSecret } from "./errors";
import { type Argon2Params, xchachaOpen } from "./primitives";
import { HEADER_LEN, type UnlockedVault } from "./wharfv";

// The body nonce is the trailing 24 bytes of the header (OFF_BODY_NONCE = 194,
// HEADER_LEN = 218). Kept local rather than exported from wharfv so this mobile
// extension stays self-contained.
const BODY_NONCE_LEN = 24;

// openWithDek decrypts a WHARFV blob's payload using a known DEK, skipping the
// password/recovery KEK derivation. Throws `corrupt` on a structurally short
// blob and `wrong-secret` when the DEK fails to open the body — the latter means
// the cached DEK is stale (the blob was re-keyed on another device), and callers
// fall back to a password unlock and re-enrol biometrics.
export async function openWithDek(blob: Uint8Array, dek: Uint8Array): Promise<Uint8Array> {
  if (blob.length < HEADER_LEN) {
    throw corrupt();
  }
  const aad = blob.slice(0, HEADER_LEN);
  const bodyNonce = aad.slice(HEADER_LEN - BODY_NONCE_LEN);
  const body = blob.slice(HEADER_LEN);
  const payload = await xchachaOpen(dek, bodyNonce, body, aad);
  if (!payload) {
    throw wrongSecret();
  }
  return payload;
}

// Fixed header offsets for the argon2 cost fields (see the layout comment at the
// top of wharfv.ts): time u32 LE @9, memory u32 LE @13, parallelism u8 @17.
// Duplicated read-only here so this extension does not need wharfv's private
// parseHeader; the fixture test pins them against a Go-created blob.
const OFF_TIME = 9;
const OFF_MEMORY = 13;
const OFF_PARALLEL = 17;

// unlockVaultWithDek is openWithDek plus the session bookkeeping: it returns a
// full UnlockedVault (same shape as unlockWithPassword) so a biometric unlock
// can prime the session identically — including the header needed by
// sealPayload — without ever touching argon2.
export async function unlockVaultWithDek(
  blob: Uint8Array,
  dek: Uint8Array,
): Promise<UnlockedVault> {
  const payload = await openWithDek(blob, dek);
  const header = blob.slice(0, HEADER_LEN);
  const view = new DataView(header.buffer, header.byteOffset, header.byteLength);
  const params: Argon2Params = {
    iterations: view.getUint32(OFF_TIME, true),
    memoryKiB: view.getUint32(OFF_MEMORY, true),
    parallelism: header[OFF_PARALLEL],
  };
  return { dek: dek.slice(), payload, params, header };
}
