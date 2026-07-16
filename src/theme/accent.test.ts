import { hexToRgbTriple } from "./accent";

describe("hexToRgbTriple", () => {
  it("converts the default teal accent to its RGB channel triple", () => {
    // #57D7C2 → 87 215 194 (must match the global.css :root default).
    expect(hexToRgbTriple("#57D7C2")).toBe("87 215 194");
  });

  it("handles the other accent options", () => {
    expect(hexToRgbTriple("#6FB3E8")).toBe("111 179 232");
    expect(hexToRgbTriple("#C983E8")).toBe("201 131 232");
    expect(hexToRgbTriple("#FFC86B")).toBe("255 200 107");
  });

  it("accepts a hex without the leading hash", () => {
    expect(hexToRgbTriple("000000")).toBe("0 0 0");
  });
});
