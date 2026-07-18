import type { IdentityStatus } from "@/vault/identity";
import type { ProjectMetaEntry } from "@/vault/storage";
import { type ProjectHostSecretDeps, readProjectStoredPassword } from "./projectHostSecret";

const enc = (s: string) => new TextEncoder().encode(s);

// A decrypted project document holding one password-auth host.
const PROJECT_DOC = enc(
  JSON.stringify({
    schema: 1,
    hosts: [
      { id: "ph1", name: "shared-db", user: "deploy", addr: "db.io", port: 22, password: "s3cret" },
    ],
  }),
);

const READY: IdentityStatus = {
  kind: "ready",
  keys: { publicKey: new Uint8Array(32), privateKey: new Uint8Array(32) },
};

const ENTRY: ProjectMetaEntry = {
  name: "Atlas",
  role: "MEMBER",
  version: 5,
  fingerprint: "fp",
  wrappedDek: "wrapped",
};

// The real extractStoredPassword is pure and covered by hostSecret.test; use it so
// the payload → password mapping is exercised end-to-end here.
function makeDeps(over: Partial<ProjectHostSecretDeps> = {}): ProjectHostSecretDeps {
  return {
    getVaultVersion: () => 3,
    ensureIdentity: async () => READY,
    readProjectMeta: async () => ({ pj1: ENTRY }),
    loadCached: async () => PROJECT_DOC,
    extractStoredPassword: (payload, id) => {
      const doc = JSON.parse(new TextDecoder().decode(payload)) as {
        hosts?: { id?: string; password?: string }[];
      };
      const host = doc.hosts?.find((h) => h.id === id);
      return typeof host?.password === "string" ? host.password : "";
    },
    ...over,
  };
}

describe("readProjectStoredPassword", () => {
  it("returns the stored password from the cached project blob", async () => {
    const pw = await readProjectStoredPassword("pj1", "ph1", makeDeps());
    expect(pw).toBe("s3cret");
  });

  it("passes the store vault version through to ensureIdentity", async () => {
    const ensureIdentity = jest.fn(async () => READY);
    await readProjectStoredPassword(
      "pj1",
      "ph1",
      makeDeps({ getVaultVersion: () => 7, ensureIdentity }),
    );
    expect(ensureIdentity).toHaveBeenCalledWith(7);
  });

  it("returns '' when the identity is not ready (locked / needs-sync)", async () => {
    const deps = makeDeps({ ensureIdentity: async () => ({ kind: "needs-sync" }) });
    expect(await readProjectStoredPassword("pj1", "ph1", deps)).toBe("");
  });

  it("returns '' when the project has no local meta entry", async () => {
    const deps = makeDeps({ readProjectMeta: async () => ({}) });
    expect(await readProjectStoredPassword("pj1", "ph1", deps)).toBe("");
  });

  it("returns '' when the cached blob will not open", async () => {
    const deps = makeDeps({ loadCached: async () => null });
    expect(await readProjectStoredPassword("pj1", "ph1", deps)).toBe("");
  });

  it("returns '' for a host without a stored password", async () => {
    const noPw = enc(JSON.stringify({ schema: 1, hosts: [{ id: "ph1", name: "shared-db" }] }));
    const deps = makeDeps({ loadCached: async () => noPw });
    expect(await readProjectStoredPassword("pj1", "ph1", deps)).toBe("");
  });

  it("resolves '' instead of throwing when a dep rejects", async () => {
    const deps = makeDeps({
      loadCached: async () => {
        throw new Error("disk error");
      },
    });
    expect(await readProjectStoredPassword("pj1", "ph1", deps)).toBe("");
  });
});
