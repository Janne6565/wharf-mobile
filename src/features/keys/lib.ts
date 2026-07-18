import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";
import { fromBase64, toBase64 } from "@/crypto";

// How many leading SHA-256 bytes to show as the identity fingerprint. Eight bytes
// (16 hex chars, colon-grouped) is enough to recognise/verify a key at a glance
// without dumping the full 44-char base64 public key.
const FINGERPRINT_BYTES = 8;

// A short, human-comparable fingerprint of an X25519 public key: the SHA-256 of
// the raw key bytes, truncated and colon-grouped (e.g. "1a:2b:3c:…"). Falls back
// to an empty string if the base64 does not decode (never expected for a stored
// identity, but keeps the read-only screen crash-free).
export function identityFingerprint(publicKeyBase64: string): string {
  let bytes: Uint8Array;
  try {
    bytes = fromBase64(publicKeyBase64);
  } catch {
    return "";
  }
  const digest = sha256(bytes).slice(0, FINGERPRINT_BYTES);
  return (bytesToHex(digest).match(/.{2}/g) ?? []).join(":");
}

// The OpenSSH SHA-256 key fingerprint of an authorized_keys line — the same
// string `ssh-keygen -lf` and the Wharf TUI show: "SHA256:" + unpadded base64 of
// the SHA-256 of the raw public-key blob (the second whitespace field of the
// line, e.g. "AAAAC3Nz…"). Returns "" for empty or unparseable input so the
// read-only Keys tab stays crash-free (the fingerprint row is then omitted).
export function sshFingerprint(authorizedKeyLine: string): string {
  const blobB64 = authorizedKeyLine.trim().split(/\s+/)[1];
  if (!blobB64) {
    return "";
  }
  let blob: Uint8Array;
  try {
    blob = fromBase64(blobB64);
  } catch {
    return "";
  }
  if (blob.length === 0) {
    return "";
  }
  // Unpadded standard base64, matching OpenSSH's fingerprint format.
  return `SHA256:${toBase64(sha256(blob)).replace(/=+$/, "")}`;
}
