import { accentGlow, dotGlow, hexToRgba } from "./effects";

describe("hexToRgba", () => {
  it("converts a hex colour and alpha to an rgba() string", () => {
    expect(hexToRgba("#69D26E", 0.4)).toBe("rgba(105, 210, 110, 0.4)");
  });

  it("tolerates a hex without the leading '#'", () => {
    expect(hexToRgba("08110F", 1)).toBe("rgba(8, 17, 15, 1)");
  });
});

describe("glow helpers", () => {
  it("accentGlow embeds the accent tint at 0.28 alpha", () => {
    expect(accentGlow("#57D7C2")).toBe("0 8px 24px rgba(87, 215, 194, 0.28)");
  });

  it("dotGlow defaults to 0.4 alpha and accepts an override", () => {
    expect(dotGlow("#69D26E")).toBe("0 0 10px 1px rgba(105, 210, 110, 0.4)");
    expect(dotGlow("#E3C078", 0.35)).toBe("0 0 10px 1px rgba(227, 192, 120, 0.35)");
  });
});
