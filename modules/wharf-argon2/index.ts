// JS surface of the `wharf-argon2` local Expo module.
//
// Why this module exists: the Wharf vault derives argon2id keys with
// parallelism = 4 over RAW BYTE secrets (a 25-byte binary recovery secret is not
// valid UTF-8). react-native-libsodium's `crypto_pwhash` cannot vary the lane
// count (libsodium's high-level API fixes it), and off-the-shelf RN argon2
// wrappers take the password as a UTF-8 *string*, which corrupts binary secrets.
// This module takes both the secret and salt as raw bytes (base64 across the
// bridge) and honours the parallelism parameter — argon2kt on Android,
// Argon2Swift on iOS, both byte-compatible with Go's argon2.IDKey.
//
// The module is only present in a native dev-client build (its Kotlin/Swift are
// compiled by `expo prebuild` + the app build). Jest never imports this file —
// the crypto layer resolves the Node primitive backend there.
import { requireNativeModule } from "expo-modules-core";

interface WharfArgon2Native {
  // All byte parameters are standard base64 (RFC 4648) strings; the return value
  // is the base64 of the raw 32-byte argon2id hash.
  argon2idRaw(
    passwordBase64: string,
    saltBase64: string,
    iterations: number,
    memoryKiB: number,
    parallelism: number,
    hashLength: number,
  ): Promise<string>;
}

const native = requireNativeModule<WharfArgon2Native>("WharfArgon2");

// argon2idRaw derives a raw argon2id hash from base64-encoded secret + salt.
export function argon2idRaw(
  passwordBase64: string,
  saltBase64: string,
  iterations: number,
  memoryKiB: number,
  parallelism: number,
  hashLength: number,
): Promise<string> {
  return native.argon2idRaw(
    passwordBase64,
    saltBase64,
    iterations,
    memoryKiB,
    parallelism,
    hashLength,
  );
}
