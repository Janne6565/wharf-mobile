import { extractVaultKeyRefs } from "./keySecret";

const enc = (s: string) => new TextEncoder().encode(s);

// A payload whose keys carry verbatim `material` plus fields the extraction does
// not read — proving it pulls name+material from the RAW key, and skips malformed
// entries (missing name / missing material).
const DOC = enc(
  JSON.stringify({
    schema: 3,
    hosts: [],
    keys: [
      { id: "1", name: "zeta", type: "ed25519", material: "bWF0Wg==", publicKey: "ssh-ed25519 x" },
      { id: "2", name: "alpha", type: "rsa", material: "bWF0QQ==", futureField: 1 },
      { id: "3", name: "no-material", type: "ed25519" },
      { id: "4", type: "ed25519", material: "bWF0" },
    ],
  }),
);

describe("extractVaultKeyRefs", () => {
  it("returns name+material for well-formed keys, sorted by name", () => {
    expect(extractVaultKeyRefs(DOC)).toEqual([
      { name: "alpha", materialB64: "bWF0QQ==" },
      { name: "zeta", materialB64: "bWF0Wg==" },
    ]);
  });

  it("skips entries missing a name or material", () => {
    const names = extractVaultKeyRefs(DOC).map((r) => r.name);
    expect(names).not.toContain("no-material");
    expect(names).toHaveLength(2);
  });

  it("returns [] when the payload has no keys array", () => {
    expect(extractVaultKeyRefs(enc(JSON.stringify({ schema: 2, hosts: [] })))).toEqual([]);
  });

  it("returns [] for an unparsable payload", () => {
    expect(extractVaultKeyRefs(enc("{not json"))).toEqual([]);
  });
});

describe("bound key (schema 5)", () => {
  const payload = new TextEncoder().encode(
    JSON.stringify({
      schema: 5,
      hosts: [],
      keys: [
        { id: "1111", name: "work", material: "bWF0LTE=" },
        { id: "2222", name: "other", material: "bWF0LTI=" },
      ],
    }),
  );

  // Every key offered spends one of the server's MaxAuthTries, so a host that
  // knows its key must not drag the rest of the vault along.
  it("returns only the bound key", () => {
    expect(extractVaultKeyRefs(payload, "1111")).toEqual([
      { name: "work", materialB64: "bWF0LTE=" },
    ]);
  });

  it("offers every key when the host is unbound", () => {
    expect(extractVaultKeyRefs(payload)).toHaveLength(2);
  });

  // The key may have been removed on another device. Trying every key beats
  // trying none.
  it("falls back to every key when the binding resolves to nothing", () => {
    expect(extractVaultKeyRefs(payload, "9999")).toHaveLength(2);
  });
});
