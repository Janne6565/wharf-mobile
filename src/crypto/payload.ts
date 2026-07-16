// The initial vault payload for a freshly created account. Matches the document
// that wharf-tui's internal/store writes for an empty vault: schema 1, no hosts,
// and DefaultSettings (theme "abyss", agent + keepalive on, telemetry off). Key
// order mirrors the Go struct field order for a tidy, predictable document.

export const INITIAL_VAULT_DOCUMENT = {
  schema: 1,
  hosts: [],
  settings: {
    theme: "abyss",
    agent: true,
    keepalive: true,
    telemetry: false,
  },
} as const;

const encoder = new TextEncoder();

export function initialVaultPayload(): Uint8Array {
  return encoder.encode(JSON.stringify(INITIAL_VAULT_DOCUMENT));
}
