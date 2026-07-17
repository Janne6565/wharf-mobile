// Reads a host's stored password from the RAW decrypted personal payload held in
// memory (vaultSession). This is deliberately separate from document.ts, which
// maps hosts onto a typed VaultHost that OMITS `password` so a stored secret can
// never leak into the UI simply by rendering a host. The ONLY caller is the
// terminal connect path, which needs the secret transiently to replay it — it is
// never placed in Redux or in state that outlives the connection flow.

import { getVaultSession } from "./vaultSession";

// extractStoredPassword pulls the `password` string for the host with id from a
// raw decrypted payload; "" when the host is absent or has no stored password.
// Pure (payload in, string out) so it unit-tests without a live session.
export function extractStoredPassword(payload: Uint8Array, id: string): string {
  let doc: { hosts?: unknown };
  try {
    doc = JSON.parse(new TextDecoder().decode(payload)) as { hosts?: unknown };
  } catch {
    return "";
  }
  const hosts = Array.isArray(doc.hosts) ? doc.hosts : [];
  for (const host of hosts) {
    if (typeof host === "object" && host !== null) {
      const raw = host as Record<string, unknown>;
      if (raw.id === id) {
        return typeof raw.password === "string" ? raw.password : "";
      }
    }
  }
  return "";
}

// readStoredPassword resolves the stored password for a personal host from the
// current unlocked session. Returns "" when the vault is locked, the host lives
// in a project (not the personal payload), or no password is stored — in every
// case the engine will fall back to prompting.
export function readStoredPassword(id: string): string {
  const session = getVaultSession();
  if (!session) {
    return "";
  }
  return extractStoredPassword(session.payload, id);
}
