// Reads synced SSH key material from the RAW decrypted personal payload held in
// memory (vaultSession). This is deliberately separate from document.ts, which
// maps keys onto a typed VaultKeyMeta that OMITS `material` so the private key
// can never leak into the UI simply by rendering a key. The ONLY caller is the
// terminal connect path, which needs the material transiently to hand it to the
// native engine for key-mode auth — it is never placed in Redux or in state that
// outlives the connection flow (same discipline as hostSecret.ts).

import type { SshVaultKeyRef } from "../../modules/wharf-ssh";
import { getVaultSession } from "./vaultSession";

// extractVaultKeyRefs pulls the {name, materialB64} pairs from a raw decrypted
// payload's `keys` array, skipping any entry without a string name AND string
// material. The result is sorted by name to match the TUI's stable store order,
// so the engine offers keys deterministically. Pure (payload in, refs out) so it
// unit-tests without a live session.
export function extractVaultKeyRefs(payload: Uint8Array): readonly SshVaultKeyRef[] {
  let doc: { keys?: unknown };
  try {
    doc = JSON.parse(new TextDecoder().decode(payload)) as { keys?: unknown };
  } catch {
    return [];
  }
  const keys = Array.isArray(doc.keys) ? doc.keys : [];
  const refs: SshVaultKeyRef[] = [];
  for (const key of keys) {
    if (typeof key === "object" && key !== null) {
      const raw = key as Record<string, unknown>;
      if (typeof raw.name === "string" && typeof raw.material === "string") {
        refs.push({ name: raw.name, materialB64: raw.material });
      }
    }
  }
  return refs.sort((a, b) => a.name.localeCompare(b.name));
}

// readVaultKeyRefs resolves the synced key material for the current unlocked
// session. Returns [] when the vault is locked or no keys are synced — the engine
// then has no vault keys to offer and falls back to the password prompt.
export function readVaultKeyRefs(): readonly SshVaultKeyRef[] {
  const session = getVaultSession();
  if (!session) {
    return [];
  }
  return extractVaultKeyRefs(session.payload);
}
