// Public surface of the client-side crypto module. The server never sees
// passwords, derived master keys, recovery secrets, or vault plaintext.

export { fromBase64, toBase64 } from "./base64";
export {
  decodeCrockford,
  encodeCrockford,
  formatRecoveryGroups,
  looksLikeRecoveryCode,
  normalizeRecovery,
  RECOVERY_CODE_LEN,
  RECOVERY_GROUP_SIZE,
  RECOVERY_SECRET_LEN,
  recoverySecretFromCode,
} from "./crockford";
export { CryptoError, type CryptoErrorCode } from "./errors";
export {
  AUTH_INFO,
  deriveAuthKey,
  deriveMasterKey,
  deriveRecoveryAuthKey,
  normalizeEmail,
  RECOVERY_AUTH_INFO,
} from "./keys";
export { INITIAL_VAULT_DOCUMENT, initialVaultPayload } from "./payload";
export type { Argon2Params } from "./primitives";
export { randomBytes } from "./primitives";
export {
  HEADER_LEN as PROJECT_HEADER_LEN,
  openProject,
  sealProject,
} from "./wharfp";
export {
  createVault,
  DEFAULT_PARAMS,
  HEADER_LEN,
  reEncrypt,
  type SealedVault,
  sealPayload,
  type UnlockedVault,
  unlockWithPassword,
  unlockWithRecovery,
} from "./wharfv";
// Mobile-only extension (not part of the byte-identical port set) for the
// biometric cached-DEK unlock path.
export { openWithDek, unlockVaultWithDek } from "./wharfv-dek";
export {
  generateKeypair,
  openDek,
  sealDek,
  WRAPPED_DEK_LEN,
  X25519_KEY_LEN,
} from "./x25519";
