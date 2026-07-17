// The on-device known_hosts path handed to the native SSH engine for TOFU host
// key verification. It lives beside the vault blob in the app document directory
// (the same home storage.ts uses). Isolated in its own module so useTerminalLogic
// unit-tests can mock it without pulling in expo-file-system.

import { File, Paths } from "expo-file-system";

// knownHostsPath returns a plain filesystem path (no file:// scheme) — the Go
// knownhosts store expects an OS path, not a URI.
export function knownHostsPath(): string {
  return new File(Paths.document, "known_hosts").uri.replace(/^file:\/\//, "");
}
