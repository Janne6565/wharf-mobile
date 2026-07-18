// Host CRUD at the vault-document level: pure functions that take the current
// decrypted payload bytes and return NEW payload bytes with a host added, edited
// or removed. Framework-free and side-effect-free, so they unit-test without
// crypto, storage or Redux (hostMutations.ts wires those on top).
//
// Two invariants matter for a well-behaved sync participant:
//   1. UNKNOWN FIELDS ARE PRESERVED. We mutate the RAW parsed JSON (not the
//      stripped VaultDocument), so a host's stored `password`, `keyPath`,
//      `source`, `lastSeen` — and any field a newer TUI adds — survive an edit
//      untouched. The mobile form only ever writes name/user/addr/port/tags.
//   2. VALIDATION MATCHES THE TUI (store.go validateHostIn): name + addr
//      required, port defaulted to 22 then constrained to 1..65535, and a
//      case-insensitive unique name. New hosts get a 16-hex-char id, source
//      "manual" and authMethod "key" — exactly what store.AddHost assigns.

import { randomBytes } from "@/crypto";

export const PORT_MIN = 1;
export const PORT_MAX = 65535;
export const DEFAULT_PORT = 22;
const HOST_ID_BYTES = 8; // 16 hex chars, matching store.newID()

export type HostMutationErrorCode =
  | "name-required"
  | "addr-required"
  | "port-range"
  | "name-duplicate"
  | "not-found";

export class HostMutationError extends Error {
  constructor(readonly code: HostMutationErrorCode) {
    super(`host mutation error: ${code}`);
    this.name = "HostMutationError";
  }
}

// The editable subset the mobile host form owns.
export interface HostInput {
  readonly name: string;
  readonly user: string;
  readonly addr: string;
  readonly port: number;
  readonly tags: readonly string[];
}

type RawHost = Record<string, unknown>;
interface RawDoc {
  hosts?: unknown;
  [key: string]: unknown;
}

function newHostId(): string {
  const bytes = randomBytes(HOST_ID_BYTES);
  let hex = "";
  for (const b of bytes) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

function parse(payload: Uint8Array): { doc: RawDoc; hosts: RawHost[] } {
  const doc = JSON.parse(new TextDecoder().decode(payload)) as RawDoc;
  const hosts = Array.isArray(doc.hosts) ? (doc.hosts as RawHost[]) : [];
  return { doc, hosts };
}

function serialize(doc: RawDoc, hosts: RawHost[]): Uint8Array {
  return new TextEncoder().encode(JSON.stringify({ ...doc, hosts }));
}

function normalizePort(port: number): number {
  return !port || Number.isNaN(port) ? DEFAULT_PORT : port;
}

// validate enforces the shared add/edit rules against the existing hosts.
// excludeId is the id of the host being edited (undefined for adds) so a host
// does not collide with its own name.
function validate(
  hosts: readonly RawHost[],
  input: HostInput,
  port: number,
  excludeId?: string,
): void {
  if (input.name.trim() === "") {
    throw new HostMutationError("name-required");
  }
  if (input.addr.trim() === "") {
    throw new HostMutationError("addr-required");
  }
  if (port < PORT_MIN || port > PORT_MAX) {
    throw new HostMutationError("port-range");
  }
  const name = input.name.trim().toLowerCase();
  for (const host of hosts) {
    if (host.id === excludeId) {
      continue;
    }
    if (typeof host.name === "string" && host.name.trim().toLowerCase() === name) {
      throw new HostMutationError("name-duplicate");
    }
  }
}

// The editable fields written onto a raw host, in the TUI's field order. tags is
// omitted when empty (Go's `omitempty`), preserving the tidy document shape.
function applyEditable(target: RawHost, input: HostInput, port: number): void {
  target.name = input.name.trim();
  target.user = input.user.trim();
  target.addr = input.addr.trim();
  target.port = port;
  const tags = input.tags.map((t) => t.trim()).filter((t) => t.length > 0);
  if (tags.length > 0) {
    target.tags = tags;
  } else {
    delete target.tags;
  }
}

// addHostToPayload appends a new manual host and returns the new payload + id.
export function addHostToPayload(
  payload: Uint8Array,
  input: HostInput,
): { payload: Uint8Array; id: string } {
  const { doc, hosts } = parse(payload);
  const port = normalizePort(input.port);
  validate(hosts, input, port);
  const id = newHostId();
  const host: RawHost = { id, source: "manual", authMethod: "key" };
  applyEditable(host, input, port);
  return { payload: serialize(doc, [...hosts, host]), id };
}

// updateHostInPayload merges the editable fields into the existing host with id,
// preserving every other stored field (password, keyPath, source, lastSeen, …).
export function updateHostInPayload(payload: Uint8Array, id: string, input: HostInput): Uint8Array {
  const { doc, hosts } = parse(payload);
  const index = hosts.findIndex((h) => h.id === id);
  if (index < 0) {
    throw new HostMutationError("not-found");
  }
  const port = normalizePort(input.port);
  validate(hosts, input, port, id);
  const next = hosts.map((h) => ({ ...h }));
  applyEditable(next[index], input, port);
  return serialize(doc, next);
}

// deleteHostFromPayload removes the host with id, or throws if it is gone.
export function deleteHostFromPayload(payload: Uint8Array, id: string): Uint8Array {
  const { doc, hosts } = parse(payload);
  const next = hosts.filter((h) => h.id !== id);
  if (next.length === hosts.length) {
    throw new HostMutationError("not-found");
  }
  return serialize(doc, next);
}

// extractRawHostFromPayload returns a deep copy of the RAW host object with id —
// carrying ALL its stored fields (password, keyPath, tags, and any field a newer
// TUI adds), not the stripped typed view — so a "move to project" can re-home the
// host without losing its secrets. A JSON round-trip detaches the copy from the
// source payload's parsed tree. Throws not-found when the id is absent.
export function extractRawHostFromPayload(
  payload: Uint8Array,
  id: string,
): Record<string, unknown> {
  const { hosts } = parse(payload);
  const host = hosts.find((h) => h.id === id);
  if (!host) {
    throw new HostMutationError("not-found");
  }
  return JSON.parse(JSON.stringify(host)) as Record<string, unknown>;
}

// addRawHostToPayload appends an already-formed raw host (from
// extractRawHostFromPayload) to a document's hosts, preserving every other doc
// field and tolerating hosts:null/absent (a TUI-written empty project). Throws
// name-duplicate when the doc already holds a host with the same trimmed,
// case-insensitive name. Unlike addHostToPayload it assigns no id/source/authMethod
// — the host keeps its own, so a move is lossless and probe results (keyed by id)
// stay valid.
export function addRawHostToPayload(
  payload: Uint8Array,
  host: Record<string, unknown>,
): Uint8Array {
  const { doc, hosts } = parse(payload);
  const name = typeof host.name === "string" ? host.name.trim().toLowerCase() : "";
  for (const existing of hosts) {
    if (typeof existing.name === "string" && existing.name.trim().toLowerCase() === name) {
      throw new HostMutationError("name-duplicate");
    }
  }
  return serialize(doc, [...hosts, host]);
}

// setHostPasswordInPayload stores a per-host password on the host with id and
// switches its authMethod to "password" — exactly what the TUI's "remember this
// password" (ctrl+r) does. Every other stored field (keyPath, source, tags,
// lastSeen, and any field a newer TUI adds) is preserved: we mutate the RAW
// parsed host, copying nothing away. Used by the terminal flow when the user
// ticks "remember" and the connection then succeeds.
export function setHostPasswordInPayload(
  payload: Uint8Array,
  id: string,
  password: string,
): Uint8Array {
  const { doc, hosts } = parse(payload);
  const index = hosts.findIndex((h) => h.id === id);
  if (index < 0) {
    throw new HostMutationError("not-found");
  }
  const next = hosts.map((h) => ({ ...h }));
  next[index].password = password;
  next[index].authMethod = "password";
  return serialize(doc, next);
}
