// Content identity of a vault payload, byte-identical to the TUI's
// sync.fingerprint (engine.go): the SHA-256 hex of the canonical payload JSON
// bytes AS STORED. The payload bytes ARE the canonical form — we hash them
// verbatim, never re-marshalling — so a payload produced by the Go client and
// the same payload round-tripped through this app hash to the same value, which
// is what lets the two ends agree on "did this side change?" across the wire.
//
// SHA-256 comes from @noble/hashes (synchronous, pure JS, the same primitive the
// native crypto backend uses) so fingerprinting needs no async plumbing and no
// libsodium/argon2 machinery.

import { sha256 } from "@noble/hashes/sha2.js";
import { bytesToHex } from "@noble/hashes/utils.js";

// fingerprint returns the lowercase SHA-256 hex of the raw payload bytes.
export function fingerprint(payload: Uint8Array): string {
  return bytesToHex(sha256(payload));
}

// countHosts parses just enough of a payload to count its hosts. An empty or
// unparsable payload counts as zero — matching engine.go's countHosts, which the
// zero-hosts auto-resolution depends on.
export function countHosts(payload: Uint8Array): number {
  if (payload.length === 0) {
    return 0;
  }
  try {
    const doc = JSON.parse(new TextDecoder().decode(payload)) as { hosts?: unknown };
    return Array.isArray(doc.hosts) ? doc.hosts.length : 0;
  } catch {
    return 0;
  }
}
