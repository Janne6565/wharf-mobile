import {
  ACCESSORY_SEQUENCES,
  anyModifierArmed,
  applyModifiers,
  NO_MODIFIERS,
  toggleModifier,
} from "./lib";

describe("ACCESSORY_SEQUENCES", () => {
  it("maps the mock's keycaps to their escape sequences", () => {
    expect(ACCESSORY_SEQUENCES.esc).toBe("\x1b");
    expect(ACCESSORY_SEQUENCES.tab).toBe("\t");
    expect(ACCESSORY_SEQUENCES.up).toBe("\x1b[A");
    expect(ACCESSORY_SEQUENCES.down).toBe("\x1b[B");
    expect(ACCESSORY_SEQUENCES.slash).toBe("/");
    expect(ACCESSORY_SEQUENCES.tilde).toBe("~");
  });
});

describe("toggleModifier / anyModifierArmed", () => {
  it("arms then disarms a modifier on repeated toggles", () => {
    const armed = toggleModifier(NO_MODIFIERS, "ctrl");
    expect(armed).toEqual({ ctrl: true, alt: false });
    expect(anyModifierArmed(armed)).toBe(true);

    const disarmed = toggleModifier(armed, "ctrl");
    expect(disarmed).toEqual(NO_MODIFIERS);
    expect(anyModifierArmed(disarmed)).toBe(false);
  });

  it("toggles each modifier independently", () => {
    const ctrlAlt = toggleModifier(toggleModifier(NO_MODIFIERS, "ctrl"), "alt");
    expect(ctrlAlt).toEqual({ ctrl: true, alt: true });
  });
});

describe("applyModifiers", () => {
  it("is the identity with no modifier armed", () => {
    expect(applyModifiers("a", NO_MODIFIERS)).toBe("a");
    expect(applyModifiers("\x1b[A", NO_MODIFIERS)).toBe("\x1b[A");
  });

  it("maps ctrl + letter to the control code (case-insensitive)", () => {
    expect(applyModifiers("a", { ctrl: true, alt: false })).toBe("\x01");
    expect(applyModifiers("C", { ctrl: true, alt: false })).toBe("\x03"); // Ctrl-C
    expect(applyModifiers("z", { ctrl: true, alt: false })).toBe("\x1a");
  });

  it("leaves ctrl + non-letter unchanged", () => {
    expect(applyModifiers("5", { ctrl: true, alt: false })).toBe("5");
    expect(applyModifiers("/", { ctrl: true, alt: false })).toBe("/");
    expect(applyModifiers("ab", { ctrl: true, alt: false })).toBe("ab");
  });

  it("prefixes ESC for alt", () => {
    expect(applyModifiers("f", { ctrl: false, alt: true })).toBe("\x1bf");
  });

  it("applies ctrl then alt together (ESC + control code)", () => {
    expect(applyModifiers("c", { ctrl: true, alt: true })).toBe("\x1b\x03");
  });
});
