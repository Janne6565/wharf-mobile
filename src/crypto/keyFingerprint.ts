// The human-comparable fingerprint of an X25519 public key, byte-identical to
// wharf-web and the TUI. Its whole purpose is cross-device comparison — a user
// reads the fingerprint here and checks it against the one another client shows
// — so the format is a protocol detail, not a presentation choice: SHA-256 of the
// raw 32 key bytes, standard base64 of the digest with `=` padding stripped, the
// first 16 characters, grouped into four blocks of four separated by a space.
//
// (Distinct from `@/features/keys/lib`'s `identityFingerprint`, the colon-hex
// display format the Keys tab has always shown. That one is mobile-only; this one
// is the shared one, so it is the only one used for the mismatch warning.)

import { sha256 } from "@noble/hashes/sha2.js";
import { toBase64 } from "./base64";

const FINGERPRINT_CHARS = 16;
const GROUP_SIZE = 4;

// publicKeyFingerprint returns e.g. "Zmh6 rfhi vXds j8GL" for the given raw
// public-key bytes.
export function publicKeyFingerprint(publicKey: Uint8Array): string {
  const digest = toBase64(sha256(publicKey)).replace(/=+$/, "").slice(0, FINGERPRINT_CHARS);
  return (digest.match(new RegExp(`.{1,${GROUP_SIZE}}`, "g")) ?? []).join(" ");
}
