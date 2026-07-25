// Email + master-password login. The full credential derivation happens on the
// device (zero-knowledge contract, PLAN §B): argon2id master key → HKDF auth key
// → POST /auth/login in DIRECT mode. The server only ever receives the derived
// auth key (which it bcrypt-hashes), never the password.

import type { SessionResponse } from "@/api/generated/model";
import { LoginRequestTokenMode } from "@/api/generated/model";
import { login } from "@/api/wharf";
import { deriveAuthKey, deriveMasterKey, normalizeEmail } from "@/crypto";

export interface EmailCredentials {
  readonly email: string;
  readonly password: string;
}

// emailLogin derives the auth key and authenticates. It runs argon2id ONCE (for
// the auth-key derivation). Note that the subsequent vault unlock (see
// src/vault/unlock.ts) runs argon2id a SECOND time: the vault's password slot
// uses its own random salt, distinct from the email-hash salt used here, so the
// two KEKs are genuinely different and the master key cannot be reused as the
// vault KEK. Two argon2 passes at sign-in is therefore unavoidable; the payoff is
// the biometric cached-DEK path, which then unlocks with zero argon2 passes.
//
// Failures propagate as raw Axios errors for the caller to map: besides the usual
// 401, the backend now answers 403 with the `email_not_verified` problem code when
// the credentials are correct but the address was never confirmed. Signing up and
// verifying are web-only, so this app can only recognise that state and say so —
// see useSignInLogic.
export async function emailLogin({ email, password }: EmailCredentials): Promise<SessionResponse> {
  const normalized = normalizeEmail(email);
  const masterKey = await deriveMasterKey(password, normalized);
  const authKey = await deriveAuthKey(masterKey);
  return login({
    email: normalized,
    authKey,
    tokenMode: LoginRequestTokenMode.DIRECT,
  });
}
