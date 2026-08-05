import fixture from "./__fixtures__/project-fixture.json";
import { fromBase64 } from "./base64";
import { encodeIdentity, HYBRID_PUB_LEN, HYBRID_WRAPPED_DEK_LEN } from "./hybrid";
import { openProject, sealProject } from "./wharfp";
import { openDek, sealDek } from "./x25519";

// Byte-compatibility proof for the Wharf Projects crypto layer. The fixture was
// produced by wharf-tui's Go `internal/vault` (TestWriteProjectFixture): a
// sealed-box-wrapped project DEK and a WHARFP project blob. If the TypeScript
// port unwraps the DEK and opens the blob to the exact payload — and its own
// sealed blob has the identical WHARFP header layout — the two implementations
// are byte-for-byte compatible: same crypto_box_seal wrapping and same
// XChaCha20-Poly1305 sealing with the 32-byte header as AAD.
describe("byte-compat with wharf-tui Go project crypto", () => {
  const pub = fromBase64(fixture.publicKeyBase64);
  const priv = fromBase64(fixture.privateKeyBase64);
  const dek = fromBase64(fixture.dekBase64);
  const wrappedDek = fromBase64(fixture.wrappedDekBase64);
  const projectBlob = fromBase64(fixture.projectBlobBase64);

  it("unwraps the Go sealed-box DEK to the exact DEK bytes", async () => {
    const opened = await openDek(wrappedDek, pub, priv);
    expect(opened).toEqual(dek);
  });

  it("unwraps the Go hybrid (ML-KEM-768 + X25519) DEK to the same DEK bytes", async () => {
    const hybridPub = fromBase64(fixture.hybridPublicKeyBase64);
    const hybridPriv = fromBase64(fixture.hybridPrivateKeyBase64);
    const hybridWrapped = fromBase64(fixture.hybridWrappedDekBase64);

    expect(hybridPub.length).toBe(HYBRID_PUB_LEN);
    expect(hybridWrapped.length).toBe(HYBRID_WRAPPED_DEK_LEN);
    // The hybrid identity embeds the very X25519 key the v1 fixture uses: that
    // is what lets an upgraded account still open its pre-upgrade DEKs.
    expect(hybridPub.subarray(1, 33)).toEqual(pub);

    expect(await openDek(hybridWrapped, hybridPub, hybridPriv)).toEqual(dek);
    // ...and the classical wrap still opens with the upgraded identity.
    expect(await openDek(wrappedDek, hybridPub, hybridPriv)).toEqual(dek);
  });

  it("derives the same hybrid public key Go did from the stored seed", async () => {
    const hybridPub = fromBase64(fixture.hybridPublicKeyBase64);
    const hybridPriv = fromBase64(fixture.hybridPrivateKeyBase64);
    const encoded = encodeIdentity(pub, priv, hybridPriv.subarray(33));
    expect(encoded.publicKey).toEqual(hybridPub);
    expect(encoded.privateKey).toEqual(hybridPriv);
  });

  it("wraps to the Go hybrid public key in a form it can open again", async () => {
    const hybridPub = fromBase64(fixture.hybridPublicKeyBase64);
    const hybridPriv = fromBase64(fixture.hybridPrivateKeyBase64);
    const wrapped = await sealDek(dek, hybridPub);
    expect(wrapped.length).toBe(HYBRID_WRAPPED_DEK_LEN);
    expect(wrapped[0]).toBe(0x02);
    expect(await openDek(wrapped, hybridPub, hybridPriv)).toEqual(dek);
  });

  it("opens the Go WHARFP blob to the exact payload", async () => {
    const payload = await openProject(dek, projectBlob);
    expect(new TextDecoder().decode(payload)).toBe(fixture.payloadUtf8);
  });

  it("seals a blob with the exact WHARFP header layout Go expects", async () => {
    const payloadBytes = new TextEncoder().encode(fixture.payloadUtf8);
    const blob = await sealProject(dek, payloadBytes);
    // magic
    expect(new TextDecoder().decode(blob.subarray(0, 6))).toBe("WHARFP");
    // version uint16 LE = 1
    const view = new DataView(blob.buffer, blob.byteOffset, blob.byteLength);
    expect(view.getUint16(6, true)).toBe(1);
    // 32-byte header (magic + version + 24-byte body nonce) then ciphertext
    // (payload + 16-byte Poly1305 tag).
    expect(blob.length).toBe(32 + payloadBytes.length + 16);
    const reopened = await openProject(dek, blob);
    expect(new TextDecoder().decode(reopened)).toBe(fixture.payloadUtf8);
  });
});
