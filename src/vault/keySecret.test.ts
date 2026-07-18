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
