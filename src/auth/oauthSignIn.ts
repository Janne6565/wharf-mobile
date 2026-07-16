// In-app Google/GitHub sign-in (PLAN §B, browser device-code, no manual typing).
// The system browser opens the backend's OAuth authorize endpoint; on success the
// backend 302-redirects to the app's `wharf://oauth` deep link carrying an 8-char
// device code (or an error code), which we exchange for a DIRECT-mode session via
// the same device-code path the manual pairing screen uses.
//
// The URL-building and redirect-parsing are pure helpers (no expo imports needed
// to exercise them) so the contract can be unit-tested without mocking the browser.

import * as WebBrowser from "expo-web-browser";
import { API_BASE } from "@/api/axios-instance";
import type { SessionResponse } from "@/api/generated/model";
import { pairDevice } from "@/auth/pairing";

// The deep link the backend redirects to after the consent flow. Registered as the
// app scheme in app.config.js; openAuthSessionAsync closes the browser when the
// redirect matches this prefix.
export const OAUTH_REDIRECT_URL = "wharf://oauth";

// Failure codes the backend can hand back on the redirect (`?error=<code>`). An
// `invalid_state` failure lands on the website instead, so the browser session is
// simply dismissed by the user — treated as a cancel, not an error, here.
export const OAUTH_ERROR_CODES = [
  "provider_disabled",
  "email_not_verified",
  "provider_error",
  "server_error",
] as const;

export type OAuthErrorCode = (typeof OAUTH_ERROR_CODES)[number] | "unknown";

// A parsed redirect: either a device code to exchange, or a mapped error code.
export type OAuthRedirect =
  | { readonly status: "code"; readonly code: string }
  | { readonly status: "error"; readonly error: OAuthErrorCode };

// The outcome of a full sign-in attempt surfaced to the caller.
export type OAuthOutcome =
  | { readonly status: "session"; readonly session: SessionResponse }
  | { readonly status: "cancelled" };

// Thrown when the browser redirect carried an error code, so the logic hook can
// map it to a user-facing message (email_not_verified gets its own copy).
export class OAuthSignInError extends Error {
  readonly code: OAuthErrorCode;
  constructor(code: OAuthErrorCode) {
    super(`oauth sign-in failed: ${code}`);
    this.name = "OAuthSignInError";
    this.code = code;
  }
}

// buildAuthorizeUrl composes the backend authorize endpoint for a provider slug.
// API_BASE is the bare origin (generated paths carry /api/v1), so the prefix is
// spelled out here. `client=mobile` tells the backend to redirect to the app deep
// link rather than the website.
export function buildAuthorizeUrl(provider: string): string {
  return `${API_BASE}/api/v1/auth/oauth/${provider}/authorize?client=mobile`;
}

// isKnownErrorCode narrows an arbitrary redirect value to a documented code.
function toErrorCode(raw: string | null): OAuthErrorCode {
  return (OAUTH_ERROR_CODES as readonly string[]).includes(raw ?? "")
    ? (raw as OAuthErrorCode)
    : "unknown";
}

// queryParam reads a single query parameter out of a URL string by hand, so the
// parser stays pure and deterministic across the RN runtime and the test runner
// (no dependency on a URL/URLSearchParams polyfill). Fragments are stripped.
function queryParam(url: string, key: string): string | null {
  const query = url.split("?").slice(1).join("?").split("#")[0];
  if (!query) {
    return null;
  }
  for (const pair of query.split("&")) {
    const eq = pair.indexOf("=");
    const rawKey = eq === -1 ? pair : pair.slice(0, eq);
    if (rawKey === key) {
      const rawValue = eq === -1 ? "" : pair.slice(eq + 1);
      return decodeURIComponent(rawValue);
    }
  }
  return null;
}

// parseOAuthRedirect maps the `wharf://oauth?...` deep link into a typed result:
// a `code` wins when present; otherwise the `error` param is mapped to a known
// code (unrecognised or absent → "unknown", so raw codes never reach the UI).
export function parseOAuthRedirect(url: string): OAuthRedirect {
  const code = queryParam(url, "code");
  if (code) {
    return { status: "code", code };
  }
  return { status: "error", error: toErrorCode(queryParam(url, "error")) };
}

// oauthSignIn drives the whole browser round-trip: open the authorize URL, wait
// for the deep-link redirect, and either exchange the device code for a session,
// throw a typed error, or report a silent cancel (user dismissed the browser).
export async function oauthSignIn(provider: string): Promise<OAuthOutcome> {
  const result = await WebBrowser.openAuthSessionAsync(
    buildAuthorizeUrl(provider),
    OAUTH_REDIRECT_URL,
  );
  if (result.type !== "success") {
    // cancel / dismiss (and any non-redirect result) — nothing to report.
    return { status: "cancelled" };
  }
  const redirect = parseOAuthRedirect(result.url);
  if (redirect.status === "error") {
    throw new OAuthSignInError(redirect.error);
  }
  const session = await pairDevice(redirect.code);
  return { status: "session", session };
}
