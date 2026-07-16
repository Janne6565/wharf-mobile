// Narrow an unknown error to its HTTP status, when it is an Axios error with a
// response. Used by feature hooks to map failures to user-facing messages and by
// the session layer to distinguish "server rejected the token" (drop it) from
// "network unreachable" (keep it).

import { isAxiosError } from "axios";

export function getHttpStatus(error: unknown): number | undefined {
  return isAxiosError(error) ? error.response?.status : undefined;
}
