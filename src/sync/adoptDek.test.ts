import {
  type Argon2Params,
  CryptoError,
  createVault,
  openWithDek,
  sealPayload,
  unlockWithPassword,
} from "@/crypto";

// Proof of the adopt-remote DEK story: adopting a remote vault re-seals its
// payload under the LOCAL DEK, so the biometric DEK cache (which holds the local
// DEK) keeps working — even when the remote was re-keyed under a different DEK.
//
// Fast argon2 params keep the test quick while exercising the real WHARFV format
// (createVault → sealPayload → openWithDek/unlockWithPassword), under the Node
// primitive backend.
const FAST: Argon2Params = { iterations: 1, memoryKiB: 8, parallelism: 1 };

const enc = (s: string) => new TextEncoder().encode(s);
const LOCAL_PAYLOAD = enc('{"schema":1,"hosts":[]}');
const REMOTE_PAYLOAD = enc('{"schema":1,"hosts":[{"id":"2","name":"remote"}]}');

describe("adopt keeps the local DEK", () => {
  it("re-seals a foreign-DEK remote payload under our DEK, preserving both unlock paths", async () => {
    // Two independently created vaults have DIFFERENT random DEKs.
    const local = await createVault("local-pw", LOCAL_PAYLOAD, FAST);
    const remote = await createVault("remote-pw", REMOTE_PAYLOAD, FAST);
    expect(remote.vault.dek).not.toEqual(local.vault.dek);

    // The remote blob cannot be opened with the local (cached) DEK — this is WHY
    // adopt cannot just store the remote blob: the biometric cache would break.
    await expect(openWithDek(remote.blob, local.vault.dek)).rejects.toBeInstanceOf(CryptoError);

    // Adopt opens the remote blob with the master password (foreign salts/DEK)…
    const opened = await unlockWithPassword(remote.blob, "remote-pw");
    expect(opened.payload).toEqual(REMOTE_PAYLOAD);

    // …then re-seals that payload under OUR unlocked vault (same DEK + slots).
    const adoptedBlob = await sealPayload(local.vault, opened.payload);

    // The adopted blob opens with our LOCAL DEK — the biometric cache stays valid.
    expect(await openWithDek(adoptedBlob, local.vault.dek)).toEqual(REMOTE_PAYLOAD);
    // And with our LOCAL password, since the key slots were preserved untouched.
    const reUnlocked = await unlockWithPassword(adoptedBlob, "local-pw");
    expect(reUnlocked.payload).toEqual(REMOTE_PAYLOAD);
  }, 30_000);
});
