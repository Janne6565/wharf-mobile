import fixture from "@/crypto/__fixtures__/vault-fixture.json";
import { countHosts, fingerprint } from "./fingerprint";

const encode = (s: string) => new TextEncoder().encode(s);

describe("fingerprint", () => {
  // Parity with wharf-tui's sync.fingerprint: the SHA-256 hex of the canonical
  // payload bytes AS STORED. The fixture's payloadUtf8 is the exact document the
  // Go client writes for an empty vault; its fingerprint is a stable golden that
  // the Go side (crypto/sha256 over the same bytes) produces identically.
  const GOLDEN = "755f43bdca9252c420f24cea983d0db8f9d0ace78215ebf750b3a4fdf5459666";

  it("hashes the Go fixture payload bytes to the stable golden hex", () => {
    expect(fingerprint(encode(fixture.payloadUtf8))).toBe(GOLDEN);
  });

  it("is stable across calls and lowercase 64-hex", () => {
    const fp = fingerprint(encode('{"schema":1,"hosts":[]}'));
    expect(fp).toBe(fingerprint(encode('{"schema":1,"hosts":[]}')));
    expect(fp).toMatch(/^[0-9a-f]{64}$/);
  });

  it("differs when any payload byte changes", () => {
    expect(fingerprint(encode('{"a":1}'))).not.toBe(fingerprint(encode('{"a":2}')));
  });
});

describe("countHosts", () => {
  it("counts the hosts array", () => {
    expect(countHosts(encode('{"hosts":[{"id":"a"},{"id":"b"}]}'))).toBe(2);
  });

  it("treats empty, missing-hosts, and unparsable payloads as zero", () => {
    expect(countHosts(new Uint8Array(0))).toBe(0);
    expect(countHosts(encode('{"schema":1}'))).toBe(0);
    expect(countHosts(encode("not json{"))).toBe(0);
  });
});
