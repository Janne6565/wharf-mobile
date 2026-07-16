// Pure helpers for the pairing-code input. The backend normalises dashes and
// case itself; these only shape what the user sees (XXXX-XXXX, uppercase) and
// derive the raw 8-char code for the exchange call.

import { PAIRING_CODE_LEN } from "@/lib/validators";

const GROUP_SIZE = PAIRING_CODE_LEN / 2;

// Strip everything that is not a letter/digit, uppercase, cap at 8 chars.
export function rawPairingCode(input: string): string {
  return input
    .replace(/[^a-zA-Z0-9]/g, "")
    .toUpperCase()
    .slice(0, PAIRING_CODE_LEN);
}

// Render the raw code as the display form: "ABCD-1234" (dash appears once the
// first group is complete).
export function formatPairingCode(input: string): string {
  const raw = rawPairingCode(input);
  if (raw.length <= GROUP_SIZE) {
    return raw;
  }
  return `${raw.slice(0, GROUP_SIZE)}-${raw.slice(GROUP_SIZE)}`;
}

export function isCompletePairingCode(input: string): boolean {
  return rawPairingCode(input).length === PAIRING_CODE_LEN;
}
