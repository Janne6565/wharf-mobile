// Biometric-gated DEK cache (PLAN §B / decision F.4: biometric-gated cached DEK,
// confirmed). After the first successful password unlock the user may opt in to
// Face ID / fingerprint: the 32-byte vault DEK — never the password — is stored
// base64 in a SecureStore entry created with `requireAuthentication: true`, so
// the OS keystore/keychain itself demands a fresh biometric before releasing it.
// Subsequent unlocks read the entry (triggering the system biometric prompt) and
// open the blob body directly via openWithDek — zero argon2 passes.
//
// The cache stays valid across password changes / recovery resets / sealPayload,
// all of which preserve the DEK. If a pulled blob was re-keyed elsewhere the DEK
// fails to open it (wrong-secret) and callers fall back to the password prompt
// and re-enrol.

import * as LocalAuthentication from "expo-local-authentication";
import * as SecureStore from "expo-secure-store";
import { fromBase64, toBase64 } from "@/crypto";

// Key name fixed by the spec; its own keychain service because a
// requireAuthentication entry needs a freshly generated key, which must not be
// shared with the non-authenticated session items (see expo-secure-store docs).
const DEK_KEY = "wharf-vault-dek";
const KEYCHAIN_SERVICE = "wharf-vault-dek";

// A parallel, non-gated flag mirroring whether a DEK is enrolled. SecureStore
// cannot answer "does this requireAuthentication entry exist?" without popping
// the biometric prompt, so existence is tracked separately (it is not a secret).
const ENROLLED_FLAG_KEY = "wharf-vault-dek-enrolled";
const FLAG_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: "wharf-session",
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

const DEK_OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  requireAuthentication: true,
  keychainAccessible: SecureStore.WHEN_UNLOCKED_THIS_DEVICE_ONLY,
};

// Whether the device can gate a SecureStore entry behind biometrics at all:
// hardware present, at least one biometric enrolled with the OS.
export async function canEnrollBiometrics(): Promise<boolean> {
  const [hasHardware, enrolled] = await Promise.all([
    LocalAuthentication.hasHardwareAsync(),
    LocalAuthentication.isEnrolledAsync(),
  ]);
  return hasHardware && enrolled && SecureStore.canUseBiometricAuthentication();
}

// Whether a DEK is currently enrolled (cheap, prompt-free).
export async function hasBiometricDek(): Promise<boolean> {
  try {
    return (await SecureStore.getItemAsync(ENROLLED_FLAG_KEY, FLAG_OPTIONS)) === "1";
  } catch {
    return false;
  }
}

// Store the DEK behind the biometric gate. `authenticationPrompt` labels the OS
// dialog on Android (iOS prompts only on read).
export async function enrollBiometricDek(dek: Uint8Array, prompt: string): Promise<void> {
  await SecureStore.setItemAsync(DEK_KEY, toBase64(dek), {
    ...DEK_OPTIONS,
    authenticationPrompt: prompt,
  });
  await SecureStore.setItemAsync(ENROLLED_FLAG_KEY, "1", FLAG_OPTIONS);
}

// Read the DEK, triggering the system biometric prompt. Returns null when the
// user cancels, authentication fails, or the entry is gone (e.g. the OS
// invalidated it after a biometric re-enrolment) — callers fall back to the
// password form.
export async function readBiometricDek(prompt: string): Promise<Uint8Array | null> {
  try {
    const stored = await SecureStore.getItemAsync(DEK_KEY, {
      ...DEK_OPTIONS,
      authenticationPrompt: prompt,
    });
    return stored ? fromBase64(stored) : null;
  } catch {
    return null;
  }
}

// Drop the cached DEK (stale DEK detected, or the user disables biometrics).
export async function clearBiometricDek(): Promise<void> {
  try {
    await SecureStore.deleteItemAsync(DEK_KEY, DEK_OPTIONS);
  } catch {
    // Deleting a missing/invalidated entry is fine — the flag below is what
    // the UI keys off.
  }
  await SecureStore.deleteItemAsync(ENROLLED_FLAG_KEY, FLAG_OPTIONS);
}
