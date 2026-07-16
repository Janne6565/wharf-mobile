// The project document is the plaintext sealed inside a project's WHARFP blob: a
// schema version and the shared hosts. It mirrors the TUI's ProjectDoc exactly so
// a blob written by the terminal opens identically here (cross-client parity): the
// canonical JSON is {"schema":1,"hosts":[...]}.
//
// An empty document written by the TUI may arrive as {"schema":1,"hosts":null};
// parseVaultDocument already tolerates a null/absent hosts array (→ []), so we
// reuse it to read project hosts too. Its typed mapping also strips any stored
// `password`, keeping it out of the read-only project host list — the same
// discipline the personal vault uses.

import { parseVaultDocument, type VaultHost } from "./document";

// Parse a decrypted project payload into its hosts, tolerating hosts:null.
export function parseProjectHosts(payload: Uint8Array): readonly VaultHost[] {
  return parseVaultDocument(payload).hosts;
}
