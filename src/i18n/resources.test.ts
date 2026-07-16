import { resources } from "./resources";

type Nested = { [key: string]: string | Nested };

function flattenKeys(obj: Nested, prefix = ""): string[] {
  return Object.entries(obj).flatMap(([key, value]) => {
    const path = prefix ? `${prefix}.${key}` : key;
    return typeof value === "string" ? [path] : flattenKeys(value, path);
  });
}

describe("i18n resources", () => {
  const languages = Object.keys(resources) as (keyof typeof resources)[];
  const baseKeys = flattenKeys(resources.en.common as Nested).sort();

  it("has at least the base language", () => {
    expect(languages).toContain("en");
  });

  it("every language shares the exact same key set", () => {
    for (const lang of languages) {
      const keys = flattenKeys(resources[lang].common as Nested).sort();
      expect(keys).toEqual(baseKeys);
    }
  });
});
