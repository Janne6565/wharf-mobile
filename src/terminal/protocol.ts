// The message protocol spoken across the xterm.js WebView bridge. Both halves —
// the RN host (useTerminalLogic) and the in-page bootstrap script baked into
// terminal.html — agree on these shapes. All terminal byte data crosses as
// base64 of the raw UTF-8 byte stream, so binary-safe and JSON-safe.

// WebView → RN.
export type TerminalOutbound =
  // xterm is initialised and window.__wharf.push is live.
  | { readonly type: "ready" }
  // A user keystroke (term.onData), base64 of its UTF-8 bytes.
  | { readonly type: "data"; readonly dataB64: string }
  // The fitted grid size (emitted on first fit and every refit).
  | { readonly type: "size"; readonly cols: number; readonly rows: number };

// RN → WebView (delivered via window.__wharf.push(json)).
export type TerminalInbound =
  // Remote shell output, base64 of its raw bytes.
  | { readonly type: "write"; readonly dataB64: string }
  // Runtime accent update (recolours the cursor).
  | { readonly type: "theme"; readonly accent: string };

// parseOutbound safely decodes a message posted by the WebView, returning null
// for anything malformed or unrecognised (never throws on hostile input).
export function parseOutbound(json: string): TerminalOutbound | null {
  let parsed: unknown;
  try {
    parsed = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof parsed !== "object" || parsed === null) {
    return null;
  }
  const msg = parsed as Record<string, unknown>;
  switch (msg.type) {
    case "ready":
      return { type: "ready" };
    case "data":
      return typeof msg.dataB64 === "string" ? { type: "data", dataB64: msg.dataB64 } : null;
    case "size":
      return typeof msg.cols === "number" && typeof msg.rows === "number"
        ? { type: "size", cols: msg.cols, rows: msg.rows }
        : null;
    default:
      return null;
  }
}

// serializeInbound encodes a message for delivery into the page.
export function serializeInbound(msg: TerminalInbound): string {
  return JSON.stringify(msg);
}
