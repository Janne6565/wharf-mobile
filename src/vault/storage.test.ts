// Round-trip tests for the on-device blob store, with expo-file-system mocked
// as an in-memory map (the real module is native-only).

import {
  clearVaultStorage,
  readVaultBlob,
  readVaultMeta,
  storeVaultBlob,
  updateVaultMeta,
  writeVaultBlob,
} from "./storage";

const mockFiles = new Map<string, Uint8Array | string>();

jest.mock("expo-file-system", () => {
  class MockFile {
    private readonly key: string;

    constructor(...parts: unknown[]) {
      this.key = parts.map((p) => String(p)).join("/");
    }

    get exists(): boolean {
      return mockFiles.has(this.key);
    }

    write(content: Uint8Array | string): void {
      mockFiles.set(this.key, content);
    }

    async bytes(): Promise<Uint8Array> {
      const value = mockFiles.get(this.key);
      if (value === undefined) {
        throw new Error("missing file");
      }
      return typeof value === "string" ? new TextEncoder().encode(value) : value;
    }

    async text(): Promise<string> {
      const value = mockFiles.get(this.key);
      if (value === undefined) {
        throw new Error("missing file");
      }
      return typeof value === "string" ? value : new TextDecoder().decode(value);
    }

    delete(): void {
      mockFiles.delete(this.key);
    }
  }

  return { File: MockFile, Paths: { document: "document" } };
});

describe("vault blob storage", () => {
  beforeEach(() => {
    mockFiles.clear();
  });

  it("returns null blob and meta before anything is stored", async () => {
    expect(await readVaultBlob()).toBeNull();
    expect(await readVaultMeta()).toBeNull();
  });

  it("round-trips the blob bytes and version", async () => {
    const blob = Uint8Array.from([1, 2, 3, 250, 251, 252]);
    await storeVaultBlob(blob, 7);

    expect(await readVaultBlob()).toEqual(blob);
    const meta = await readVaultMeta();
    expect(meta?.version).toBe(7);
    expect(meta?.storedAt).toBeTruthy();
  });

  it("overwrites on a subsequent store", async () => {
    await storeVaultBlob(Uint8Array.from([1]), 1);
    await storeVaultBlob(Uint8Array.from([9, 9]), 2);

    expect(await readVaultBlob()).toEqual(Uint8Array.from([9, 9]));
    expect((await readVaultMeta())?.version).toBe(2);
  });

  it("treats unparsable metadata as absent", async () => {
    await storeVaultBlob(Uint8Array.from([1]), 1);
    mockFiles.set("document/vault.meta.json", "not json{");
    expect(await readVaultMeta()).toBeNull();
  });

  it("clears blob and metadata", async () => {
    await storeVaultBlob(Uint8Array.from([1, 2]), 3);
    await clearVaultStorage();

    expect(await readVaultBlob()).toBeNull();
    expect(await readVaultMeta()).toBeNull();
    expect(mockFiles.size).toBe(0);
  });

  it("merges metadata fields without clobbering the others", async () => {
    await storeVaultBlob(Uint8Array.from([1]), 4);
    await updateVaultMeta({ userId: "u1", userEmail: "u@x.io" });
    await updateVaultMeta({ fingerprint: "abc123" });

    const meta = await readVaultMeta();
    expect(meta).toMatchObject({
      version: 4,
      userId: "u1",
      userEmail: "u@x.io",
      fingerprint: "abc123",
    });
  });

  it("writeVaultBlob replaces the blob without touching the version/fingerprint", async () => {
    await storeVaultBlob(Uint8Array.from([1]), 7);
    await updateVaultMeta({ fingerprint: "fp-at-7" });

    writeVaultBlob(Uint8Array.from([2, 2]));

    expect(await readVaultBlob()).toEqual(Uint8Array.from([2, 2]));
    const meta = await readVaultMeta();
    expect(meta?.version).toBe(7);
    expect(meta?.fingerprint).toBe("fp-at-7");
  });
});
