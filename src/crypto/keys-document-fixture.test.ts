import fixture from "@/crypto/__fixtures__/keys-document-fixture.json";
import { sshFingerprint } from "@/features/keys/lib";
import { parseVaultDocument } from "@/vault/document";
import { extractVaultKeyRefs } from "@/vault/keySecret";

// Cross-language parity proof for the schema-3 synced-SSH-keys document. The
// fixture is the exact `store.Save` output from wharf-tui's Go source of truth
// (internal/store TestWriteKeysDocumentFixture): a schema-3 personal vault with a
// host, an identity and two vault keys — an unencrypted and a passphrase-encrypted
// ed25519. Proving this mobile port parses it identically — same schema/metadata,
// `material` stripped from the typed view, verbatim material read transiently, and
// OpenSSH SHA256 fingerprints matching Go's ssh.FingerprintSHA256 — is what keeps
// the three clients in lockstep.
describe("byte-compat with wharf-tui Go schema-3 keys document", () => {
  const payload = new TextEncoder().encode(fixture.payloadUtf8);
  const raw = JSON.parse(fixture.payloadUtf8) as {
    keys: { name: string; material: string }[];
  };

  it("parses schema and key metadata to match the expected values", () => {
    const doc = parseVaultDocument(payload);
    expect(doc.schema).toBe(fixture.expect.schema);
    expect(doc.hosts).toHaveLength(1);
    expect(doc.keys.map((k) => k.name)).toEqual(fixture.expect.keyNames);
    expect(doc.keys.map((k) => k.type)).toEqual(fixture.expect.keyTypes);
    expect(doc.keys.map((k) => k.publicKey)).toEqual(fixture.expect.publicKeys);
  });

  it("strips the secret `material` from the typed key metadata", () => {
    const doc = parseVaultDocument(payload);
    for (const key of doc.keys) {
      expect(key).not.toHaveProperty("material");
    }
  });

  it("reads verbatim key material via extractVaultKeyRefs, name-sorted", () => {
    const refs = extractVaultKeyRefs(payload);
    // Keys are name-sorted in the fixture, so refs align with the expect arrays.
    expect(refs.map((r) => r.name)).toEqual(fixture.expect.keyNames);
    for (let i = 0; i < refs.length; i++) {
      // The base64 material must be the verbatim bytes from the raw JSON.
      expect(refs[i].materialB64).toBe(raw.keys[i].material);
    }
  });

  it("derives the exact OpenSSH SHA256 fingerprint Go produces for each key", () => {
    fixture.expect.publicKeys.forEach((line, i) => {
      expect(sshFingerprint(line)).toBe(fixture.expect.fingerprints[i]);
    });
  });
});
