// Durable holder for the long-lived refresh token, kept in the OS keychain via
// expo-secure-store (AUTH.md: refresh token persisted, access token in memory).
// The refresh token is a small opaque string well under SecureStore's ~2 KB
// ceiling. It is NOT behind biometrics — it only mints access tokens, never
// decrypts the vault; the vault DEK is the biometric-gated secret (see
// src/vault/biometric.ts).

import * as SecureStore from "expo-secure-store";

const REFRESH_TOKEN_KEY = "wharf-refresh-token";
// A distinct keychain service namespaces our items and keeps them clear of the
// biometric DEK entry (which uses requireAuthentication and its own service).
const KEYCHAIN_SERVICE = "wharf-session";

const OPTIONS: SecureStore.SecureStoreOptions = {
  keychainService: KEYCHAIN_SERVICE,
  // Available after the first post-boot unlock so a background refresh can run
  // while the phone is locked; not migrated to a new device on restore.
  keychainAccessible: SecureStore.AFTER_FIRST_UNLOCK_THIS_DEVICE_ONLY,
};

export async function getRefreshToken(): Promise<string | null> {
  return SecureStore.getItemAsync(REFRESH_TOKEN_KEY, OPTIONS);
}

export async function setRefreshToken(token: string): Promise<void> {
  await SecureStore.setItemAsync(REFRESH_TOKEN_KEY, token, OPTIONS);
}

export async function clearRefreshToken(): Promise<void> {
  await SecureStore.deleteItemAsync(REFRESH_TOKEN_KEY, OPTIONS);
}
