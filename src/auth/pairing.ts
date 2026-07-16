// Device-code pairing — the OAuth path for mobile (PLAN §B). Google/GitHub sign-in
// happens in the system browser on the web app, which shows an 8-char pairing
// code; the phone exchanges that code here for a DIRECT-mode session. This is also
// the only path for OAuth-only accounts that never set a master password.

import * as Device from "expo-device";
import type { SessionResponse } from "@/api/generated/model";
import { exchangeDeviceCode } from "@/api/wharf";

// A human-readable device label the backend records against the session, so the
// pairing shows up recognisably in the account's device list.
function deviceLabel(): string {
  return Device.deviceName ?? Device.modelName ?? "Wharf Mobile";
}

// pairDevice normalises the entered code loosely (the backend strips dashes and
// case, but trimming here avoids sending obvious whitespace) and exchanges it.
export async function pairDevice(code: string): Promise<SessionResponse> {
  return exchangeDeviceCode({ code: code.trim(), deviceName: deviceLabel() });
}
