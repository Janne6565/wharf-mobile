// High-level key derivation, matching wharf-backend's zero-knowledge contract.
// The server only ever receives the derived authKey / recoveryAuthKey (which it
// bcrypt-hashes) and the opaque vault blob — never the password or plaintext.

import { toBase64 } from "./base64";
import { type Argon2Params, deriveArgon2id, hkdfSha256, sha256 } from "./primitives";

export const MASTER_KEY_PARAMS: Argon2Params = {
  iterations: 3,
  memoryKiB: 64 * 1024,
  parallelism: 4,
};

export const AUTH_INFO = "wharf/auth/v1";
export const RECOVERY_AUTH_INFO = "wharf/recovery-auth/v1";

const encoder = new TextEncoder();

export function normalizeEmail(email: string): string {
  return email.trim().toLowerCase();
}

// masterKey = argon2id(password, salt = first 16 bytes of SHA-256(normalized
// email), t=3, m=64 MiB, p=4, 32-byte output).
export async function deriveMasterKey(password: string, email: string): Promise<Uint8Array> {
  const emailHash = await sha256(encoder.encode(normalizeEmail(email)));
  const salt = emailHash.slice(0, 16);
  return deriveArgon2id(encoder.encode(password), salt, MASTER_KEY_PARAMS);
}

// authKey = base64(HKDF-SHA256(masterKey, info="wharf/auth/v1", 32 bytes)).
export async function deriveAuthKey(masterKey: Uint8Array): Promise<string> {
  return toBase64(await hkdfSha256(masterKey, AUTH_INFO, 32));
}

// recoveryAuthKey = base64(HKDF-SHA256(recoverySecret,
// info="wharf/recovery-auth/v1", 32 bytes)).
export async function deriveRecoveryAuthKey(recoverySecret: Uint8Array): Promise<string> {
  return toBase64(await hkdfSha256(recoverySecret, RECOVERY_AUTH_INFO, 32));
}
