// Pure, framework-free terminal input helpers. No React, no native imports — so
// the sticky-modifier transform and the accessory-key sequences unit-test in
// isolation. The logic hook wires these onto the WharfSsh write path.

// The escape sequences the on-screen accessory row emits. `ctrl`/`alt` are NOT
// here — they are sticky modifiers (see Modifiers), not literal sequences.
export const ACCESSORY_SEQUENCES = {
  esc: "\x1b",
  tab: "\t",
  slash: "/",
  tilde: "~",
  up: "\x1b[A",
  down: "\x1b[B",
} as const;

export type AccessoryKey = keyof typeof ACCESSORY_SEQUENCES;

// The two sticky modifiers. Tapping ctrl/alt arms it; it applies to the NEXT key
// (accessory sequence or keyboard character) and then disarms.
export interface Modifiers {
  readonly ctrl: boolean;
  readonly alt: boolean;
}

export type ModifierKey = "ctrl" | "alt";

export const NO_MODIFIERS: Modifiers = { ctrl: false, alt: false };

// toggleModifier flips one sticky modifier (arm ⇄ disarm), leaving the other.
export function toggleModifier(mods: Modifiers, which: ModifierKey): Modifiers {
  return { ...mods, [which]: !mods[which] };
}

// anyModifierArmed reports whether a pending modifier should transform the next
// keystroke (so the hook knows when to intercept keyboard "data" messages).
export function anyModifierArmed(mods: Modifiers): boolean {
  return mods.ctrl || mods.alt;
}

// controlCode maps a single ASCII letter to its control character (Ctrl-A → 0x01,
// … Ctrl-Z → 0x1a); null for anything that is not a single a–z/A–Z letter.
function controlCode(input: string): string | null {
  if (input.length !== 1 || !/^[A-Za-z]$/.test(input)) {
    return null;
  }
  return String.fromCharCode(input.toUpperCase().charCodeAt(0) & 0x1f);
}

// applyModifiers transforms a keystroke under the armed sticky modifiers:
//   ctrl  — a single a–z/A–Z letter becomes its control code (others pass through)
//   alt   — the (possibly ctrl-transformed) result is prefixed with ESC (\x1b)
// With no modifier armed it is the identity, so it is safe to call on every
// keystroke. Disarming is the caller's job (it happens after the transform).
export function applyModifiers(input: string, mods: Modifiers): string {
  let out = input;
  if (mods.ctrl) {
    const code = controlCode(input);
    if (code !== null) {
      out = code;
    }
  }
  if (mods.alt) {
    out = `\x1b${out}`;
  }
  return out;
}
