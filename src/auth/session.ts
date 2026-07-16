// Session lifecycle glue: turns tokens (from email login, device-code pairing, or
// the app-start silent refresh) into UI auth state, and tears the session down on
// sign-out or a hard refresh failure. All strictly client-side — the server never
// sees a secret here.

import type { SessionResponse } from "@/api/generated/model";
import { getHttpStatus } from "@/api/httpError";
import { getCurrentUser, refresh } from "@/api/wharf";
import { store } from "@/store";
import {
  type AuthUser,
  sessionCleared,
  sessionEstablished,
  sessionResolvedAnonymous,
} from "@/store/authSlice";
import { setBiometricEnrolled, vaultLocked } from "@/store/vaultSlice";
import { clearBiometricDek, hasBiometricDek } from "@/vault/biometric";
import { clearVaultStorage } from "@/vault/storage";
import { clearVaultSession } from "@/vault/vaultSession";
import { clearMasterPassword } from "./masterSecret";
import { clearRefreshToken, getRefreshToken, setRefreshToken } from "./refreshTokenStore";
import { clearAccessToken, setAccessToken, subscribeToken } from "./tokenStore";

async function resolveUser(res?: SessionResponse): Promise<AuthUser> {
  if (res?.user?.id && res.user.email) {
    return { id: res.user.id, email: res.user.email };
  }
  const me = await getCurrentUser();
  return { id: me.id ?? "", email: me.email ?? "" };
}

// establishSession stores the tokens and publishes the signed-in user to Redux.
// Shared by the email-login and device-pairing flows (both return a
// SessionResponse with a DIRECT-mode refresh token in the body).
export async function establishSession(res: SessionResponse): Promise<void> {
  if (!res.accessToken) {
    throw new Error("session response missing access token");
  }
  setAccessToken(res.accessToken);
  if (res.refreshToken) {
    await setRefreshToken(res.refreshToken);
  }
  const user = await resolveUser(res);
  store.dispatch(sessionEstablished(user));
  store.dispatch(setBiometricEnrolled(await hasBiometricDek()));
}

// Zeroes all in-memory session/vault state and publishes the anonymous UI state.
// Split out so both an explicit sign-out and the token-lost listener can reuse it
// without re-triggering the listener (it does not touch the access token).
function tearDownSessionState(): void {
  clearMasterPassword();
  clearVaultSession();
  store.dispatch(vaultLocked());
  store.dispatch(sessionCleared());
}

// clearSession is the explicit sign-out: forget everything — in-memory state,
// refresh token, the on-disk blob and the biometric DEK cache — so the next
// launch starts anonymous with no residue of the account on the device.
export async function clearSession(): Promise<void> {
  tearDownSessionState();
  clearAccessToken();
  await Promise.all([clearRefreshToken(), clearVaultStorage(), clearBiometricDek()]);
}

let listenerWired = false;

// A hard refresh failure inside the axios interceptor clears the access token;
// mirror that into a full sign-out so the router bounces to the sign-in screen.
function wireTokenLostListener(): void {
  if (listenerWired) {
    return;
  }
  listenerWired = true;
  subscribeToken((token) => {
    if (token === null && store.getState().auth.status === "authenticated") {
      // The axios layer decides whether the stored refresh token is dropped
      // (server rejection) or kept (network blip); here we only mirror the lost
      // session into the UI.
      tearDownSessionState();
    }
  });
}

let bootstrap: Promise<void> | null = null;

// bootstrapSession runs the one-time app-start silent refresh: if a refresh token
// is in SecureStore, exchange it (DIRECT mode) for an access token and resolve the
// signed-in user; otherwise resolve anonymous. Memoized so it runs at most once
// per app launch. The router awaits the resolved auth status before routing.
export function bootstrapSession(): Promise<void> {
  wireTokenLostListener();
  if (!bootstrap) {
    bootstrap = runBootstrap();
  }
  return bootstrap;
}

async function runBootstrap(): Promise<void> {
  let hadToken = false;
  try {
    const stored = await getRefreshToken();
    if (stored) {
      hadToken = true;
      const res = await refresh({ refreshToken: stored, tokenMode: "DIRECT" });
      if (res.accessToken) {
        setAccessToken(res.accessToken);
        if (res.refreshToken) {
          await setRefreshToken(res.refreshToken);
        }
        const user = await resolveUser();
        store.dispatch(sessionEstablished(user));
        store.dispatch(setBiometricEnrolled(await hasBiometricDek()));
        return;
      }
    }
  } catch (error) {
    // Drop the stored token only when the server explicitly rejected it; a
    // network failure keeps it so the next (online) launch can restore the
    // session. Either way this launch resolves anonymous (offline cache is M3).
    const status = getHttpStatus(error);
    if (hadToken && (status === 401 || status === 403)) {
      await clearRefreshToken();
    }
    store.dispatch(sessionResolvedAnonymous());
    return;
  }
  await clearRefreshToken();
  store.dispatch(sessionResolvedAnonymous());
}
