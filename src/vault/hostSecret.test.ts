import { extractStoredPassword } from "./hostSecret";

const enc = (s: string) => new TextEncoder().encode(s);

// A payload whose host carries a stored password plus fields the mobile client
// does not model — proving extraction reads the RAW host, not the stripped type.
const DOC = enc(
  JSON.stringify({
    schema: 2,
    hosts: [
      { id: "aaa", name: "keyed", addr: "a.io", authMethod: "key", keyPath: "~/.ssh/id" },
      {
        id: "bbb",
        name: "pw",
        addr: "b.io",
        authMethod: "password",
        password: "s3cret",
        futureField: 1,
      },
    ],
  }),
);

describe("extractStoredPassword", () => {
  it("returns the stored password for the matching host", () => {
    expect(extractStoredPassword(DOC, "bbb")).toBe("s3cret");
  });

  it("returns '' when the host has no stored password", () => {
    expect(extractStoredPassword(DOC, "aaa")).toBe("");
  });

  it("returns '' for an unknown host id", () => {
    expect(extractStoredPassword(DOC, "zzz")).toBe("");
  });

  it("returns '' for an unparsable payload", () => {
    expect(extractStoredPassword(enc("{not json"), "bbb")).toBe("");
  });
});
