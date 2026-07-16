// In-memory holder for the short-lived identity (access) token. Per AUTH.md the
// access token lives only in memory; durability comes from the refresh token in
// SecureStore plus a silent refresh (both land in M2). This M0 stub exposes only
// the getter/setter contract the axios request interceptor needs — no refresh,
// no persistence yet.

let accessToken: string | null = null;
type Listener = (token: string | null) => void;
const listeners = new Set<Listener>();

export function getAccessToken(): string | null {
  return accessToken;
}

export function setAccessToken(token: string | null): void {
  accessToken = token;
  for (const listener of listeners) {
    listener(token);
  }
}

export function clearAccessToken(): void {
  setAccessToken(null);
}

// subscribe lets the Redux layer mirror token changes into UI auth state.
// Returns an unsubscribe function.
export function subscribeToken(listener: Listener): () => void {
  listeners.add(listener);
  return () => listeners.delete(listener);
}
