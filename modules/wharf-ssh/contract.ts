// Frozen contract for the `WharfSsh` native SSH engine (gomobile-backed).
//
// This file is deliberately free of any native import so it is safe to load in
// ANY environment (device, tsc, Jest) — both the real native wrapper
// (`index.ts`) and the in-memory Jest fake (`index.node.ts`) re-export it, so the
// two seam halves share ONE set of types and one error-code parser. All binary
// data crosses the bridge as standard base64 (RFC 4648) strings; `sessionId` is
// generated JS-side (random hex) BEFORE `connect` so event subscriptions are in
// place first.

// Stable prefix codes a rejected connect / a non-clean close reports. The native
// side prefixes its error message with exactly one of these (e.g.
// "auth_failed: too many authentication failures"); `parseSshErrorCode` recovers
// the code, defaulting to "unknown" for anything unrecognised.
export const SSH_ERROR_CODES = [
  "host_key_changed",
  "host_key_rejected",
  "auth_failed",
  "canceled",
  "timeout",
  "network",
  "unknown",
] as const;

export type SshErrorCode = (typeof SSH_ERROR_CODES)[number];

// parseSshErrorCode recovers the stable code from a native error message. The
// native side prefixes the code, but expo-modules-core may wrap a CodedError so
// the message can arrive as "code: detail", "ERR_SSH_CONNECT: code: detail", or
// "Error: code: detail". We therefore scan for the earliest whole-word occurrence
// of any known code (word-boundary match, so "networking" ≠ "network" and
// "auth_failed_x" ≠ "auth_failed"); the earliest position in the string wins, not
// array order. Nothing recognised → "unknown".
export function parseSshErrorCode(raw: string): SshErrorCode {
  let best: { code: SshErrorCode; index: number } | null = null;
  for (const code of SSH_ERROR_CODES) {
    const match = new RegExp(`\\b${code}\\b`).exec(raw);
    if (match && (best === null || match.index < best.index)) {
      best = { code, index: match.index };
    }
  }
  return best?.code ?? "unknown";
}

// One synced private key handed to the engine for key-mode auth: a display
// name (used as the passphrase-prompt label) plus the verbatim keyfile bytes
// (OpenSSH/PEM armor) as base64.
export interface SshVaultKeyRef {
  readonly name: string;
  readonly materialB64: string;
}

// Options for opening an interactive shell. Two auth modes, selected by
// `authMethod`:
//   "password" (default; mobile's legacy behavior): password +
//     keyboard-interactive only — `keys` are never offered.
//   "key": the synced vault `keys` are offered as public-key auth BEFORE the
//     password + keyboard-interactive fallbacks. The password fallback in key
//     mode is a deliberate deviation from the TUI (which never offers a password
//     in key mode): mobile has no agent or on-disk key files, so a key-mode host
//     whose synced keys are all unusable must still be reachable via a password.
export interface SshConnectOptions {
  readonly sessionId: string;
  readonly host: string;
  readonly port: number;
  readonly user: string;
  // The per-host stored password from the vault, replayed silently when present;
  // empty string means "no stored password" (the engine will prompt).
  readonly storedPassword: string;
  readonly termType: string;
  readonly cols: number;
  readonly rows: number;
  readonly timeoutMs: number;
  readonly knownHostsPath: string;
  // Auth mode. Optional so existing callers keep compiling; the native wrapper
  // defaults an omitted value to "password" (mobile's legacy default).
  readonly authMethod?: "key" | "password";
  // Synced vault keys offered in key mode; ignored in password mode. Optional so
  // existing callers keep compiling (treated as none when omitted).
  readonly keys?: readonly SshVaultKeyRef[];
}

// Remote shell output for a session (base64 of the raw byte stream).
export interface SshDataEvent {
  readonly sessionId: string;
  readonly dataB64: string;
}

// Session teardown. `error` is "" on a clean exit, otherwise a coded message
// (see SSH_ERROR_CODES / parseSshErrorCode).
export interface SshClosedEvent {
  readonly sessionId: string;
  readonly error: string;
}

// TOFU host-key confirmation. Resolve with resolveHostKeyPrompt(promptId, accept).
export interface SshHostKeyPromptEvent {
  readonly promptId: string;
  readonly sessionId: string;
  readonly host: string;
  readonly keyType: string;
  readonly fingerprint: string;
}

// A secret request. "password"/"password_retry" is the login password (retry =
// the previous one was rejected); "ki" is a keyboard-interactive challenge whose
// `prompt` text comes from the server and whose `echo` controls masking;
// "passphrase" is the passphrase for a synced vault key, where `prompt` is the
// key name (never offer a "remember" toggle for it). Resolve with
// resolveSecretPrompt(promptId, secretB64 | null) — null cancels.
export interface SshSecretPromptEvent {
  readonly promptId: string;
  readonly sessionId: string;
  readonly kind: "password" | "password_retry" | "ki" | "passphrase";
  readonly prompt: string;
  readonly echo: boolean;
}

// The event map the native module emits (Expo module events).
export interface WharfSshEventMap {
  onData: SshDataEvent;
  onClosed: SshClosedEvent;
  onHostKeyPrompt: SshHostKeyPromptEvent;
  onSecretPrompt: SshSecretPromptEvent;
}

// A minimal unsubscribe handle (structural match for Expo's EventSubscription),
// kept native-free so the fake need not import expo-modules-core.
export interface SshSubscription {
  remove: () => void;
}

// The public surface both seam halves implement. The screen/hook depend on this
// shape; Jest swaps in the fake, Metro/tsc use the native wrapper.
export interface WharfSshApi {
  connect: (opts: SshConnectOptions) => Promise<void>;
  // TCP-probe host:port for the host-list reachability dot. Resolves to the dial
  // RTT in milliseconds (minimum 1) on success, or -1 when unreachable (refused,
  // unroutable, or timed out). Stateless: needs no session/engine and is safe to
  // call with none. Classification (online vs degraded) is done JS-side so the
  // threshold lives with the UI (see classifyProbe).
  probe: (host: string, port: number, timeoutMs: number) => Promise<number>;
  cancelConnect: (sessionId: string) => Promise<void>;
  write: (sessionId: string, dataB64: string) => Promise<void>;
  resize: (sessionId: string, cols: number, rows: number) => Promise<void>;
  snapshot: (sessionId: string) => Promise<string>;
  close: (sessionId: string) => Promise<void>;
  closeAll: () => Promise<void>;
  resolveHostKeyPrompt: (promptId: string, accept: boolean) => Promise<void>;
  resolveSecretPrompt: (promptId: string, secretB64: string | null) => Promise<void>;
  subscribeData: (listener: (event: SshDataEvent) => void) => SshSubscription;
  subscribeClosed: (listener: (event: SshClosedEvent) => void) => SshSubscription;
  subscribeHostKeyPrompt: (listener: (event: SshHostKeyPromptEvent) => void) => SshSubscription;
  subscribeSecretPrompt: (listener: (event: SshSecretPromptEvent) => void) => SshSubscription;
}
