// Crockford base32 encode/decode and recovery-code normalization. This is a
// byte-faithful port of wharf-tui's internal/vault/recovery.go so that a code
// generated here decodes to the identical 25-byte secret the Go client expects
// (and vice-versa).

import { malformedCode } from "./errors";

// Crockford base32 alphabet (no I, L, O, U). 25 secret bytes encode to exactly
// 40 characters (200 bits / 5 bits per char).
const CROCKFORD = "0123456789ABCDEFGHJKMNPQRSTVWXYZ";

export const RECOVERY_SECRET_LEN = 25;
export const RECOVERY_CODE_LEN = 40;
export const RECOVERY_GROUP_SIZE = 5;

export function encodeCrockford(bytes: Uint8Array): string {
  let out = "";
  let buf = 0;
  let bits = 0;
  for (const c of bytes) {
    buf = (buf << 8) | c;
    bits += 8;
    while (bits >= 5) {
      bits -= 5;
      out += CROCKFORD[(buf >>> bits) & 0x1f];
    }
  }
  // 200 bits is divisible by 5, so no partial group remains.
  return out;
}

export function decodeCrockford(value: string): Uint8Array {
  const out: number[] = [];
  let buf = 0;
  let bits = 0;
  for (const ch of value) {
    const v = CROCKFORD.indexOf(ch);
    if (v < 0) {
      throw malformedCode();
    }
    buf = (buf << 5) | v;
    bits += 5;
    if (bits >= 8) {
      bits -= 8;
      out.push((buf >>> bits) & 0xff);
    }
  }
  return Uint8Array.from(out);
}

// normalizeRecovery makes user input canonical: upper-case, strip separators
// (dashes and any whitespace, so pasted multi-line codes work), and fold the
// Crockford look-alikes (I/L -> 1, O -> 0) to their digit forms.
export function normalizeRecovery(code: string): string {
  const upper = code.toUpperCase();
  let out = "";
  for (const ch of upper) {
    if (ch === "-" || /\s/.test(ch)) {
      continue;
    }
    if (ch === "I" || ch === "L") {
      out += "1";
    } else if (ch === "O") {
      out += "0";
    } else {
      out += ch;
    }
  }
  return out;
}

// recoverySecretFromCode turns arbitrary user input into the 25-byte secret, or
// throws malformedCode if it is not a well-formed code.
export function recoverySecretFromCode(code: string): Uint8Array {
  const secret = decodeCrockford(normalizeRecovery(code));
  if (secret.length !== RECOVERY_SECRET_LEN) {
    throw malformedCode();
  }
  return secret;
}

// formatRecoveryGroups splits a 40-char code into 8 groups of 5 for display.
export function formatRecoveryGroups(code: string): string[] {
  const groups: string[] = [];
  for (let i = 0; i < code.length; i += RECOVERY_GROUP_SIZE) {
    groups.push(code.slice(i, i + RECOVERY_GROUP_SIZE));
  }
  return groups;
}

// looksLikeRecoveryCode reports whether the input normalizes to a full-length
// code made entirely of valid Crockford characters — used to gate the verify
// request without throwing on every keystroke.
export function looksLikeRecoveryCode(code: string): boolean {
  const normalized = normalizeRecovery(code);
  if (normalized.length !== RECOVERY_CODE_LEN) {
    return false;
  }
  for (const ch of normalized) {
    if (CROCKFORD.indexOf(ch) < 0) {
      return false;
    }
  }
  return true;
}
