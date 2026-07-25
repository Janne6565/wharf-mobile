// Narrow an unknown error to its HTTP status, when it is an Axios error with a
// response. Used by feature hooks to map failures to user-facing messages and by
// the session layer to distinguish "server rejected the token" (drop it) from
// "network unreachable" (keep it).

import { isAxiosError } from "axios";

export function getHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}

// The backend's Problem Details bodies carry a stable machine-readable `code`
// property alongside the human-readable `detail`. Branch on this — never on
// `detail`, which is prose the backend is free to reword or translate.
export function getProblemCode(error: unknown): string | undefined {
  if (!isAxiosError(error)) {
    return undefined;
  }
  const data: unknown = error.response?.data;
  if (typeof data !== "object" || data === null) {
    return undefined;
  }
  const code = (data as { code?: unknown }).code;
  return typeof code === "string" ? code : undefined;
}

// The one problem code mobile acts on today: the account exists but its email
// address has never been verified, so the backend refuses to issue a session
// (login, refresh and device-code exchange all reject with 403 + this code).
// Verification itself is web-only — there is no in-app code entry.
export const EMAIL_NOT_VERIFIED_CODE = "email_not_verified";
