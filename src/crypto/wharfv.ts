// WHARFV vault format — a byte-for-byte TypeScript port of wharf-tui's
// internal/vault (format.go + vault.go). A blob created here is unlockable by
// the Go client and vice-versa (proven by the byte-compat fixture test).
//
// File layout (v1, little-endian):
//   off  len  field
//   0    6    magic "WHARFV"
//   6    2    version uint16 = 1
//   8    1    kdf id = 1 (argon2id)
//   9    4    argon2 time
//   13   4    argon2 memory (KiB)
//   17   1    argon2 parallelism
//   18   16   salt (password slot)
//   34   24   nonce (password slot)
//   58   48   DEK wrapped by password KEK (32B key + 16B tag)
//   106  16   salt (recovery slot)
//   122  24   nonce (recovery slot)
//   146  48   DEK wrapped by recovery KEK
//   194  24   body nonce
//   218  ...  XChaCha20-Poly1305(bodyNonce, DEK, payload, AAD = bytes[0:218])

import { encodeCrockford, RECOVERY_SECRET_LEN, recoverySecretFromCode } from "./crockford";
import { corrupt, wrongSecret } from "./errors";
import {
  type Argon2Params,
  deriveArgon2id,
  randomBytes,
  xchachaOpen,
  xchachaSeal,
} from "./primitives";

const MAGIC = "WHARFV";
const FILE_VERSION = 1;
const KDF_ARGON2ID = 1;

const SALT_LEN = 16;
const NONCE_LEN = 24;
const BODY_NONCE_LEN = 24;
const DEK_LEN = 32;
export const HEADER_LEN = 218;

const OFF_VERSION = 6;
const OFF_KDF = 8;
const OFF_TIME = 9;
const OFF_MEMORY = 13;
const OFF_PARALLEL = 17;
const OFF_PW_SALT = 18;
const OFF_PW_NONCE = 34;
const OFF_PW_WRAP = 58;
const OFF_REC_SALT = 106;
const OFF_REC_NONCE = 122;
const OFF_REC_WRAP = 146;
const OFF_BODY_NONCE = 194;

// Matches wharf-tui's vault.DefaultParams — the cost recorded in fresh headers.
export const DEFAULT_PARAMS: Argon2Params = {
  iterations: 3,
  memoryKiB: 64 * 1024,
  parallelism: 4,
};

// Generous caps mirroring format.go, rejecting absurd cost params in a tampered
// header before argon2 is run against them.
const MAX_MEMORY_KIB = 2 << 20; // 2 GiB
const MAX_TIME = 1 << 10; // 1024 passes

interface Header {
  version: number;
  kdf: number;
  params: Argon2Params;
  pwSalt: Uint8Array;
  pwNonce: Uint8Array;
  pwWrap: Uint8Array;
  recSalt: Uint8Array;
  recNonce: Uint8Array;
  recWrap: Uint8Array;
  bodyNonce: Uint8Array;
}

// An unlocked vault: the DEK and decrypted payload held in memory. Never
// serialized or persisted. `header` carries the (non-secret) fixed prefix —
// KDF params, slot salts/nonces and wrapped DEKs — of the blob it was opened
// from, so an updated payload can be re-sealed under the same slots without
// re-deriving KEKs or re-wrapping the DEK (see sealPayload).
export interface UnlockedVault {
  readonly dek: Uint8Array;
  readonly payload: Uint8Array;
  readonly params: Argon2Params;
  readonly header: Uint8Array;
}

export interface SealedVault {
  readonly blob: Uint8Array;
  readonly recoveryCode: string;
  readonly vault: UnlockedVault;
}

const textEncoder = new TextEncoder();

function validParams(p: Argon2Params): boolean {
  return (
    p.iterations >= 1 &&
    p.iterations <= MAX_TIME &&
    p.memoryKiB >= 1 &&
    p.memoryKiB <= MAX_MEMORY_KIB &&
    p.parallelism >= 1
  );
}

function marshalHeader(h: Header): Uint8Array {
  const b = new Uint8Array(HEADER_LEN);
  const view = new DataView(b.buffer);
  b.set(textEncoder.encode(MAGIC), 0);
  view.setUint16(OFF_VERSION, h.version, true);
  b[OFF_KDF] = h.kdf;
  view.setUint32(OFF_TIME, h.params.iterations, true);
  view.setUint32(OFF_MEMORY, h.params.memoryKiB, true);
  b[OFF_PARALLEL] = h.params.parallelism;
  b.set(h.pwSalt, OFF_PW_SALT);
  b.set(h.pwNonce, OFF_PW_NONCE);
  b.set(h.pwWrap, OFF_PW_WRAP);
  b.set(h.recSalt, OFF_REC_SALT);
  b.set(h.recNonce, OFF_REC_NONCE);
  b.set(h.recWrap, OFF_REC_WRAP);
  b.set(h.bodyNonce, OFF_BODY_NONCE);
  return b;
}

// parseHeader validates the fixed prefix and returns the header plus the
// remaining sealed body. Any structural problem maps to a corrupt error.
function parseHeader(data: Uint8Array): { header: Header; body: Uint8Array } {
  if (data.length < HEADER_LEN) {
    throw corrupt();
  }
  const magic = new TextDecoder().decode(data.subarray(0, OFF_VERSION));
  if (magic !== MAGIC) {
    throw corrupt();
  }
  const view = new DataView(data.buffer, data.byteOffset, data.byteLength);
  const version = view.getUint16(OFF_VERSION, true);
  if (version !== FILE_VERSION) {
    throw corrupt();
  }
  const kdf = data[OFF_KDF];
  if (kdf !== KDF_ARGON2ID) {
    throw corrupt();
  }
  const params: Argon2Params = {
    iterations: view.getUint32(OFF_TIME, true),
    memoryKiB: view.getUint32(OFF_MEMORY, true),
    parallelism: data[OFF_PARALLEL],
  };
  if (!validParams(params)) {
    throw corrupt();
  }
  const header: Header = {
    version,
    kdf,
    params,
    pwSalt: data.slice(OFF_PW_SALT, OFF_PW_NONCE),
    pwNonce: data.slice(OFF_PW_NONCE, OFF_PW_WRAP),
    pwWrap: data.slice(OFF_PW_WRAP, OFF_REC_SALT),
    recSalt: data.slice(OFF_REC_SALT, OFF_REC_NONCE),
    recNonce: data.slice(OFF_REC_NONCE, OFF_REC_WRAP),
    recWrap: data.slice(OFF_REC_WRAP, OFF_BODY_NONCE),
    bodyNonce: data.slice(OFF_BODY_NONCE, HEADER_LEN),
  };
  return { header, body: data.slice(HEADER_LEN) };
}

async function deriveKek(
  secret: Uint8Array,
  salt: Uint8Array,
  params: Argon2Params,
): Promise<Uint8Array> {
  return deriveArgon2id(secret, salt, params);
}

// A freshly built slot: fresh salt + nonce wrapping the DEK under a secret.
async function wrapSlot(
  secret: Uint8Array,
  dek: Uint8Array,
  params: Argon2Params,
): Promise<{ salt: Uint8Array; nonce: Uint8Array; wrap: Uint8Array }> {
  const salt = randomBytes(SALT_LEN);
  const nonce = randomBytes(NONCE_LEN);
  const kek = await deriveKek(secret, salt, params);
  const wrap = await xchachaSeal(kek, nonce, dek, null);
  return { salt, nonce, wrap };
}

function concat(a: Uint8Array, b: Uint8Array): Uint8Array {
  const out = new Uint8Array(a.length + b.length);
  out.set(a, 0);
  out.set(b, a.length);
  return out;
}

// buildBlob wraps a DEK under a password + recovery secret, seals the payload,
// and returns the serialized blob. Shared by create and re-encrypt.
async function buildBlob(
  dek: Uint8Array,
  payload: Uint8Array,
  passwordBytes: Uint8Array,
  recoverySecret: Uint8Array,
  params: Argon2Params,
): Promise<Uint8Array> {
  const pw = await wrapSlot(passwordBytes, dek, params);
  const rec = await wrapSlot(recoverySecret, dek, params);
  const bodyNonce = randomBytes(BODY_NONCE_LEN);
  const header = marshalHeader({
    version: FILE_VERSION,
    kdf: KDF_ARGON2ID,
    params,
    pwSalt: pw.salt,
    pwNonce: pw.nonce,
    pwWrap: pw.wrap,
    recSalt: rec.salt,
    recNonce: rec.nonce,
    recWrap: rec.wrap,
    bodyNonce,
  });
  const body = await xchachaSeal(dek, bodyNonce, payload, header);
  return concat(header, body);
}

// createVault builds a fresh vault: a random DEK, a password slot and a
// recovery slot, sealing payload under the DEK. Returns the blob, the one-time
// recovery code, and the unlocked vault (DEK + payload) primed in memory.
export async function createVault(
  password: string,
  payload: Uint8Array,
  params: Argon2Params = DEFAULT_PARAMS,
): Promise<SealedVault> {
  const dek = randomBytes(DEK_LEN);
  const recoverySecret = randomBytes(RECOVERY_SECRET_LEN);
  const recoveryCode = encodeCrockford(recoverySecret);
  const passwordBytes = textEncoder.encode(password);
  const blob = await buildBlob(dek, payload, passwordBytes, recoverySecret, params);
  return { blob, recoveryCode, vault: { dek, payload, params, header: blob.slice(0, HEADER_LEN) } };
}

async function unlock(
  blob: Uint8Array,
  slot: (
    header: Header,
  ) => Promise<{ kek: Uint8Array; salt: Uint8Array; nonce: Uint8Array; wrap: Uint8Array }>,
): Promise<UnlockedVault> {
  const { header, body } = parseHeader(blob);
  const { kek, nonce, wrap } = await slot(header);
  const dek = await xchachaOpen(kek, nonce, wrap, null);
  if (!dek) {
    throw wrongSecret();
  }
  const aad = blob.slice(0, HEADER_LEN);
  const payload = await xchachaOpen(dek, header.bodyNonce, body, aad);
  if (!payload) {
    throw corrupt();
  }
  return { dek, payload, params: header.params, header: aad };
}

export async function unlockWithPassword(
  blob: Uint8Array,
  password: string,
): Promise<UnlockedVault> {
  const passwordBytes = textEncoder.encode(password);
  return unlock(blob, async (header) => ({
    kek: await deriveKek(passwordBytes, header.pwSalt, header.params),
    salt: header.pwSalt,
    nonce: header.pwNonce,
    wrap: header.pwWrap,
  }));
}

export async function unlockWithRecovery(blob: Uint8Array, code: string): Promise<UnlockedVault> {
  const secret = recoverySecretFromCode(code);
  return unlock(blob, async (header) => ({
    kek: await deriveKek(secret, header.recSalt, header.params),
    salt: header.recSalt,
    nonce: header.recNonce,
    wrap: header.recWrap,
  }));
}

// reEncrypt re-seals an unlocked vault under a new password and a freshly
// generated recovery code, keeping the same DEK (so vault contents survive a
// password reset). Returns the new blob, the new recovery code, and the
// re-primed unlocked vault.
export async function reEncrypt(vault: UnlockedVault, newPassword: string): Promise<SealedVault> {
  const recoverySecret = randomBytes(RECOVERY_SECRET_LEN);
  const recoveryCode = encodeCrockford(recoverySecret);
  const passwordBytes = textEncoder.encode(newPassword);
  const blob = await buildBlob(
    vault.dek,
    vault.payload,
    passwordBytes,
    recoverySecret,
    vault.params,
  );
  return {
    blob,
    recoveryCode,
    vault: {
      dek: vault.dek,
      payload: vault.payload,
      params: vault.params,
      header: blob.slice(0, HEADER_LEN),
    },
  };
}

// sealPayload re-seals newPayload under the SAME DEK and the SAME key slots as
// the unlocked vault it is given, changing only the body: the wrapped-DEK slots
// (and thus the password + recovery code) are preserved untouched. It exists so
// callers can write an updated document (e.g. adding an X25519 identity) without
// re-slotting or prompting for the password. Because the body nonce lives inside
// the AAD-covered header region, re-sealing rebuilds the header with a fresh
// body nonce and re-encrypts the body against it. Returns the new blob; the
// caller is responsible for persisting it and refreshing any in-memory session.
export async function sealPayload(
  unlocked: UnlockedVault,
  newPayload: Uint8Array,
): Promise<Uint8Array> {
  const header = unlocked.header.slice();
  const bodyNonce = randomBytes(BODY_NONCE_LEN);
  header.set(bodyNonce, OFF_BODY_NONCE);
  const body = await xchachaSeal(unlocked.dek, bodyNonce, newPayload, header);
  return concat(header, body);
}

export { RECOVERY_SECRET_LEN };
