import type { VaultHost } from "@/vault/document";
import {
  EMPTY_HOST_FORM,
  type HostFormValues,
  hostFormSchema,
  hostToFormValues,
  parseTags,
  toHostInput,
} from "./lib";

const COPY = {
  nameRequired: "name required",
  addrRequired: "addr required",
  portRange: "port range",
};

const values = (over: Partial<HostFormValues> = {}): HostFormValues => ({
  ...EMPTY_HOST_FORM,
  name: "web",
  address: "web.io",
  ...over,
});

describe("hostFormSchema (format validation)", () => {
  const schema = hostFormSchema(COPY);

  it("accepts a complete host and an empty (defaulted) port", () => {
    expect(schema.safeParse(values({ port: "" })).success).toBe(true);
    expect(schema.safeParse(values({ port: "22" })).success).toBe(true);
  });

  it("rejects a missing name / address with the given messages", () => {
    const noName = schema.safeParse(values({ name: "" }));
    expect(noName.success).toBe(false);
    expect(noName.error?.issues[0]?.message).toBe(COPY.nameRequired);
    expect(schema.safeParse(values({ address: "" })).success).toBe(false);
  });

  it("rejects an out-of-range or non-integer port", () => {
    expect(schema.safeParse(values({ port: "0" })).success).toBe(false);
    expect(schema.safeParse(values({ port: "70000" })).success).toBe(false);
    expect(schema.safeParse(values({ port: "22.5" })).success).toBe(false);
    expect(schema.safeParse(values({ port: "abc" })).success).toBe(false);
  });
});

describe("parseTags", () => {
  it("splits, trims and drops empties", () => {
    expect(parseTags(" prod , db ,, ")).toEqual(["prod", "db"]);
    expect(parseTags("")).toEqual([]);
  });
});

describe("toHostInput / hostToFormValues round-trip", () => {
  it("maps form strings to a HostInput (empty port → 0 for defaulting)", () => {
    expect(toHostInput(values({ port: "", tags: "a, b" }))).toEqual({
      name: "web",
      user: "",
      addr: "web.io",
      port: 0,
      tags: ["a", "b"],
    });
    expect(toHostInput(values({ port: "2222" })).port).toBe(2222);
  });

  it("seeds the form from an existing host", () => {
    const host: VaultHost = {
      id: "1",
      name: "db",
      user: "root",
      addr: "db.io",
      port: 5432,
      tags: ["prod", "db"],
    };
    expect(hostToFormValues(host)).toEqual({
      name: "db",
      user: "root",
      address: "db.io",
      port: "5432",
      tags: "prod, db",
    });
  });
});
