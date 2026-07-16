// Module-level holder for the master password of the current unlocked session.
//
// Why hold it at all: adopting a remote vault blob with a foreign argon2 salt
// (the sync engine's "take remote" path, M3) requires re-deriving the KEK from
// the password — exactly as the Go TUI keeps the master password in memory while
// unlocked. It is set during an email sign-in / password unlock and dropped on
// lock or app-background.
//
// Caveat: JavaScript strings are immutable and interned, so this cannot be truly
// zeroed the way a Uint8Array can — clearing drops the only reference we hold and
// lets it be collected, which is the best the runtime allows. Nothing persists it.

let masterPassword: string | null = null;

export function setMasterPassword(password: string): void {
  masterPassword = password;
}

export function getMasterPassword(): string | null {
  return masterPassword;
}

export function clearMasterPassword(): void {
  masterPassword = null;
}
