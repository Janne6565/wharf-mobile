// Distinguishes a genuine AEAD / sealed-box authentication failure (wrong key,
// wrong recipient, or tampering) from any other error thrown by a primitive
// backend. The vault layer reads a `null` return from xchachaOpen / boxSealOpen as
// wrong-secret / corrupt; only a real authentication failure may be flattened to
// that null. Everything else — a wrong-length key, an unimplemented marshalling
// path, an out-of-memory fault — must propagate with its real message, so an
// implementation bug never masquerades as a wrong master password (which is
// exactly how the native XChaCha marshalling defect used to surface).
//
// The recognised messages cover both backends' underlying libraries:
//   libsodium-wrappers (Node): "ciphertext cannot be decrypted using that key"
//                              "incorrect key pair for the given ciphertext"
//   @noble/ciphers    (native): "invalid tag"
// Matching is substring + case-insensitive to stay robust across minor library
// wording changes; the phrases are specific enough not to collide with the
// wrong-length / usage errors that must keep propagating.

const AUTH_FAILURE_MARKERS: readonly string[] = [
  "cannot be decrypted", // libsodium-wrappers XChaCha auth failure
  "incorrect key pair", // libsodium-wrappers sealed-box auth failure
  "invalid tag", // @noble/ciphers Poly1305 auth failure
];

export function isAeadAuthFailure(err: unknown): boolean {
  const message = err instanceof Error ? err.message : String(err);
  const haystack = message.toLowerCase();
  return AUTH_FAILURE_MARKERS.some((marker) => haystack.includes(marker));
}
