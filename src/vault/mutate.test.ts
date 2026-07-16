import {
  addHostToPayload,
  deleteHostFromPayload,
  type HostInput,
  type HostMutationError,
  updateHostInPayload,
} from "./mutate";

const enc = (s: string) => new TextEncoder().encode(s);
const parse = (p: Uint8Array) => JSON.parse(new TextDecoder().decode(p));

// A document with settings + a password-auth host, to prove unknown/foreign
// fields (settings, the host's stored password) survive mobile mutations.
const DOC = enc(
  JSON.stringify({
    schema: 2,
    hosts: [
      {
        id: "aaa",
        name: "existing",
        user: "root",
        addr: "ex.io",
        port: 22,
        authMethod: "password",
        password: "s3cret",
        source: "manual",
      },
    ],
    settings: { theme: "abyss" },
  }),
);

const input = (over: Partial<HostInput> = {}): HostInput => ({
  name: "web",
  user: "deploy",
  addr: "web.example.com",
  port: 2222,
  tags: [],
  ...over,
});

describe("addHostToPayload", () => {
  it("appends a manual host with a 16-hex id and default auth, preserving other fields", () => {
    const { payload, id } = addHostToPayload(DOC, input({ tags: ["prod", "web"] }));
    expect(id).toMatch(/^[0-9a-f]{16}$/);
    const doc = parse(payload);
    // Untouched document scaffolding + the existing host's stored password remain.
    expect(doc.schema).toBe(2);
    expect(doc.settings).toEqual({ theme: "abyss" });
    expect(doc.hosts[0].password).toBe("s3cret");
    const added = doc.hosts[1];
    expect(added).toMatchObject({
      id,
      name: "web",
      user: "deploy",
      addr: "web.example.com",
      port: 2222,
      source: "manual",
      authMethod: "key",
      tags: ["prod", "web"],
    });
  });

  it("defaults an empty port to 22 and omits empty tags", () => {
    const doc = parse(addHostToPayload(DOC, input({ port: 0, tags: [] })).payload);
    expect(doc.hosts[1].port).toBe(22);
    expect(doc.hosts[1].tags).toBeUndefined();
  });

  it("trims fields", () => {
    const doc = parse(
      addHostToPayload(DOC, input({ name: "  spaced  ", tags: [" a ", ""] })).payload,
    );
    expect(doc.hosts[1].name).toBe("spaced");
    expect(doc.hosts[1].tags).toEqual(["a"]);
  });

  it.each<[string, Partial<HostInput>, HostMutationError["code"]]>([
    ["name required", { name: "   " }, "name-required"],
    ["addr required", { addr: "" }, "addr-required"],
    ["port too high", { port: 70000 }, "port-range"],
    ["duplicate name (case-insensitive)", { name: "EXISTING" }, "name-duplicate"],
  ])("rejects %s", (_label, over, code) => {
    expect(() => addHostToPayload(DOC, input(over))).toThrow(expect.objectContaining({ code }));
  });
});

describe("updateHostInPayload", () => {
  it("merges editable fields while preserving the stored password + auth mode", () => {
    const payload = updateHostInPayload(
      DOC,
      "aaa",
      input({ name: "renamed", user: "admin", addr: "new.io", port: 22, tags: ["db"] }),
    );
    const host = parse(payload).hosts[0];
    expect(host).toMatchObject({
      id: "aaa",
      name: "renamed",
      user: "admin",
      addr: "new.io",
      authMethod: "password", // preserved — the mobile form does not touch it
      password: "s3cret", // preserved
      source: "manual",
      tags: ["db"],
    });
  });

  it("allows keeping the same name on the edited host (self-exclusion)", () => {
    const payload = updateHostInPayload(DOC, "aaa", input({ name: "existing", addr: "ex.io" }));
    expect(parse(payload).hosts[0].name).toBe("existing");
  });

  it("throws not-found for an unknown id", () => {
    expect(() => updateHostInPayload(DOC, "zzz", input())).toThrow(
      expect.objectContaining({ code: "not-found" }),
    );
  });
});

describe("deleteHostFromPayload", () => {
  it("removes the host by id", () => {
    const payload = deleteHostFromPayload(DOC, "aaa");
    expect(parse(payload).hosts).toHaveLength(0);
  });

  it("throws not-found when the host is gone", () => {
    expect(() => deleteHostFromPayload(DOC, "zzz")).toThrow(
      expect.objectContaining({ code: "not-found" }),
    );
  });
});
