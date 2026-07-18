// Framework-agnostic parsing of the decrypted vault payload. The payload is the
// UTF-8 JSON document written by the Go TUI (the source of truth): a schema
// version, the stored hosts, and free-form settings. We deliberately map each
// raw host onto a typed VaultHost that OMITS the `password` field, so a stored
// password can never leak into the UI simply by rendering a host object.
//
// Document schema versions:
//   1 — hosts + settings only (the shape the Go TUI writes today).
//   2 — schema 1 plus an optional `identity`: the owner's X25519 keypair used to
//       wrap/unwrap Wharf Projects DEKs (crypto_box seal). The private key lives
//       ONLY inside this encrypted payload. A schema-1 document is a valid
//       schema-2 document with `identity` absent, so parsing accepts both and
//       never rejects on version.
//   3 — schema 2 plus an optional `keys` array: SSH private keys synced through
//       the personal vault (M8). Each raw key carries the verbatim keyfile bytes
//       in `material`, which — like host `password` — is DELIBERATELY OMITTED from
//       the typed VaultKeyMeta so the private material can never leak into the UI
//       by rendering a key object. The material is read transiently at connect
//       time only (see keySecret.ts). Earlier schemas simply have `keys` absent,
//       so parsing accepts 1–3 and never rejects on version.

// A stored SSH connection. Mirrors the Go host shape minus `password`, which is
// intentionally absent from the type so it is never carried into the UI.
export interface VaultHost {
  readonly id: string;
  readonly name: string;
  readonly user: string;
  readonly addr: string;
  readonly port: number;
  readonly tags?: readonly string[];
  readonly keyPath?: string;
  readonly authMethod?: "key" | "password" | "";
  readonly source?: "manual" | "ssh_config";
  readonly lastSeen?: string;
}

// The owner's X25519 identity for Wharf Projects. Introduced in schema 2 and
// optional: absent on schema-1 documents and on accounts that have not yet
// generated an identity. Both keys are base64-encoded 32-byte X25519 keys; the
// private key never leaves the encrypted vault payload.
export interface VaultIdentity {
  readonly x25519Priv: string;
  readonly x25519Pub: string;
  readonly createdAt: string;
}

// Metadata for a synced SSH key. Mirrors the Go vault key shape minus `material`
// (the verbatim keyfile bytes), which is intentionally absent from the type so the
// private key is never carried into the UI. Read the material transiently via
// keySecret.ts at connect time instead.
export interface VaultKeyMeta {
  readonly id: string;
  readonly name: string;
  readonly type: string;
  readonly publicKey?: string;
  readonly sourcePath?: string;
  readonly addedAt: string;
}

export interface VaultDocument {
  readonly schema: number;
  readonly hosts: readonly VaultHost[];
  readonly identity?: VaultIdentity;
  readonly keys: readonly VaultKeyMeta[];
}

interface RawHost {
  id?: unknown;
  name?: unknown;
  user?: unknown;
  addr?: unknown;
  port?: unknown;
  tags?: unknown;
  keyPath?: unknown;
  authMethod?: unknown;
  source?: unknown;
  lastSeen?: unknown;
}

function str(value: unknown): string {
  return typeof value === "string" ? value : "";
}

function optionalStr(value: unknown): string | undefined {
  return typeof value === "string" ? value : undefined;
}

// Map a raw JSON host onto a typed VaultHost, copying only the known fields.
// This is what keeps `password` (and any other unknown field) out of the UI.
function toHost(raw: RawHost): VaultHost {
  const tags = Array.isArray(raw.tags)
    ? raw.tags.filter((t): t is string => typeof t === "string")
    : undefined;
  const authMethod =
    raw.authMethod === "key" || raw.authMethod === "password" || raw.authMethod === ""
      ? raw.authMethod
      : undefined;
  const source = raw.source === "manual" || raw.source === "ssh_config" ? raw.source : undefined;
  return {
    id: str(raw.id),
    name: str(raw.name),
    user: str(raw.user),
    addr: str(raw.addr),
    port: typeof raw.port === "number" ? raw.port : 0,
    ...(tags && tags.length > 0 ? { tags } : {}),
    ...(raw.keyPath !== undefined ? { keyPath: optionalStr(raw.keyPath) } : {}),
    ...(authMethod !== undefined ? { authMethod } : {}),
    ...(source !== undefined ? { source } : {}),
    ...(raw.lastSeen !== undefined ? { lastSeen: optionalStr(raw.lastSeen) } : {}),
  };
}

// Map a raw JSON identity onto a typed VaultIdentity, or undefined if it is
// absent or structurally incomplete. All three fields must be strings.
function toIdentity(raw: unknown): VaultIdentity | undefined {
  if (typeof raw !== "object" || raw === null) {
    return undefined;
  }
  const { x25519Priv, x25519Pub, createdAt } = raw as Record<string, unknown>;
  if (
    typeof x25519Priv !== "string" ||
    typeof x25519Pub !== "string" ||
    typeof createdAt !== "string"
  ) {
    return undefined;
  }
  return { x25519Priv, x25519Pub, createdAt };
}

interface RawKey {
  id?: unknown;
  name?: unknown;
  type?: unknown;
  publicKey?: unknown;
  sourcePath?: unknown;
  addedAt?: unknown;
  // `material` is present in the raw JSON but deliberately NOT read here — the
  // same discipline as host `password`. It is read transiently by keySecret.ts.
}

// Map a raw JSON key onto a typed VaultKeyMeta, copying only the non-secret
// fields. Omitting `material` is what keeps the private key out of the UI.
function toKey(raw: RawKey): VaultKeyMeta {
  return {
    id: str(raw.id),
    name: str(raw.name),
    type: str(raw.type),
    addedAt: str(raw.addedAt),
    ...(raw.publicKey !== undefined ? { publicKey: optionalStr(raw.publicKey) } : {}),
    ...(raw.sourcePath !== undefined ? { sourcePath: optionalStr(raw.sourcePath) } : {}),
  };
}

// Decode and parse the decrypted vault payload into a typed document. Tolerates
// a missing/absent `hosts` array (defaults to []), a missing `identity` (schema-1
// documents, or accounts without an identity yet), and a missing/null `keys`
// array (schema 1/2 documents, or accounts with no synced keys yet).
export function parseVaultDocument(payload: Uint8Array): VaultDocument {
  const raw = JSON.parse(new TextDecoder().decode(payload)) as {
    schema?: unknown;
    hosts?: unknown;
    identity?: unknown;
    keys?: unknown;
  };
  const rawHosts = Array.isArray(raw.hosts) ? raw.hosts : [];
  const rawKeys = Array.isArray(raw.keys) ? raw.keys : [];
  const identity = toIdentity(raw.identity);
  return {
    schema: typeof raw.schema === "number" ? raw.schema : 1,
    hosts: rawHosts.map((h) => toHost(h as RawHost)),
    ...(identity ? { identity } : {}),
    keys: rawKeys.map((k) => toKey(k as RawKey)),
  };
}

// Render a host as `user@addr:port`, omitting the `user@` prefix when there is
// no user and the `:port` suffix when the port is 0 or missing.
export function hostTarget(host: VaultHost): string {
  const userPart = host.user ? `${host.user}@` : "";
  const portPart = host.port ? `:${host.port}` : "";
  return `${userPart}${host.addr}${portPart}`;
}
