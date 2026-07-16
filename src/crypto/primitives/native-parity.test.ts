// Proves the pure-JS @noble primitives the NATIVE backend ships (./nobleSodium)
// are byte-identical to libsodium-wrappers — the library the Node backend and the
// Go/TUI/web clients agree on. Because ./nobleSodium imports no native code it runs
// unchanged under Node, so this closes the "the device XChaCha/box path is
// unprovable in CI" gap for everything except argon2 (which stays on the native
// module and is re-checked by the on-device self-test).
//
// It also pins the error-normalization contract: a genuine AEAD/sealed-box
// authentication failure returns null (→ wrong-secret/corrupt), while any other
// fault propagates with its real message instead of masquerading as a wrong
// password — the defect that turned the native JSI marshalling error into
// "wrong master password".

import _sodium from "libsodium-wrappers";
import { isAeadAuthFailure } from "./aeadError";
import { boxSealOpen as nodeBoxSealOpen, xchachaOpen as nodeXchachaOpen } from "./index.node";
import {
  boxKeypairNoble,
  boxSealNoble,
  boxSealOpenNoble,
  xchachaOpenNoble,
  xchachaSealNoble,
} from "./nobleSodium";

const random = (n: number): Uint8Array => {
  const out = new Uint8Array(n);
  globalThis.crypto.getRandomValues(out);
  return out;
};

let sodium: typeof _sodium;
beforeAll(async () => {
  await _sodium.ready;
  sodium = _sodium;
});

describe("native @noble XChaCha20-Poly1305 == libsodium-wrappers", () => {
  it("produces byte-identical ciphertext across empty and binary AAD, both directions", () => {
    for (let t = 0; t < 64; t++) {
      const key = random(32);
      const nonce = random(24);
      const plaintext = random((t * 7) % 200);
      const adLen = (t * 3) % 64;
      const aad = adLen ? random(adLen) : null;

      const ctNoble = xchachaSealNoble(key, nonce, plaintext, aad);
      const ctSodium = sodium.crypto_aead_xchacha20poly1305_ietf_encrypt(
        plaintext,
        aad,
        null,
        nonce,
        key,
      );
      expect(Buffer.from(ctNoble)).toEqual(Buffer.from(ctSodium));

      // Cross-open each library's ciphertext with the other.
      expect(Buffer.from(xchachaOpenNoble(key, nonce, ctSodium, aad) as Uint8Array)).toEqual(
        Buffer.from(plaintext),
      );
      const openedSodium = sodium.crypto_aead_xchacha20poly1305_ietf_decrypt(
        null,
        ctNoble,
        aad,
        nonce,
        key,
      );
      expect(Buffer.from(openedSodium)).toEqual(Buffer.from(plaintext));
    }
  });

  it("returns null on a tampered ciphertext (authentication failure)", () => {
    const key = random(32);
    const nonce = random(24);
    const aad = random(32);
    const ct = xchachaSealNoble(key, nonce, random(48), aad);
    ct[ct.length - 1] ^= 0xff;
    expect(xchachaOpenNoble(key, nonce, ct, aad)).toBeNull();
  });

  it("propagates an unexpected error (wrong key length) instead of masking it as null", () => {
    const nonce = random(24);
    const ct = xchachaSealNoble(random(32), nonce, random(16), null);
    expect(() => xchachaOpenNoble(random(10), nonce, ct, null)).toThrow();
  });
});

describe("native @noble sealed box == libsodium crypto_box_seal", () => {
  it("opens a libsodium-sealed box and is opened by libsodium, byte-for-byte", () => {
    for (let t = 0; t < 32; t++) {
      const kp = sodium.crypto_box_keypair();
      const message = random(32);

      // libsodium seals -> @noble opens
      const sealedSodium = sodium.crypto_box_seal(message, kp.publicKey);
      expect(Buffer.from(boxSealOpenNoble(sealedSodium, kp.privateKey) as Uint8Array)).toEqual(
        Buffer.from(message),
      );

      // @noble seals -> libsodium opens
      const sealedNoble = boxSealNoble(message, kp.publicKey, random);
      const openedSodium = sodium.crypto_box_seal_open(sealedNoble, kp.publicKey, kp.privateKey);
      expect(Buffer.from(openedSodium)).toEqual(Buffer.from(message));
    }
  });

  it("derives an X25519 keypair whose public key matches libsodium scalarmult_base", () => {
    const { publicKey, privateKey } = boxKeypairNoble(random);
    expect(Buffer.from(publicKey)).toEqual(Buffer.from(sodium.crypto_scalarmult_base(privateKey)));
  });

  it("returns null when opened with the wrong recipient key", () => {
    const kp = sodium.crypto_box_keypair();
    const wrong = sodium.crypto_box_keypair();
    const sealed = sodium.crypto_box_seal(random(32), kp.publicKey);
    expect(boxSealOpenNoble(sealed, wrong.privateKey)).toBeNull();
  });
});

describe("Node backend error normalization", () => {
  it("returns null on a genuine wrong-secret but throws on an unexpected fault", async () => {
    const key = random(32);
    const nonce = random(24);
    const ct = xchachaSealNoble(key, nonce, random(16), null);
    // Wrong key -> authentication failure -> null.
    expect(await nodeXchachaOpen(random(32), nonce, ct, null)).toBeNull();
    // Wrong key LENGTH -> libsodium usage error -> must propagate, not mask.
    await expect(nodeXchachaOpen(random(10), nonce, ct, null)).rejects.toThrow();
  });

  it("box seal open returns null for the wrong recipient", async () => {
    const kp = sodium.crypto_box_keypair();
    const wrong = sodium.crypto_box_keypair();
    const sealed = sodium.crypto_box_seal(random(32), kp.publicKey);
    expect(await nodeBoxSealOpen(sealed, wrong.publicKey, wrong.privateKey)).toBeNull();
  });
});

describe("isAeadAuthFailure", () => {
  it("recognises both backends' auth-failure messages and nothing else", () => {
    expect(isAeadAuthFailure(new Error("ciphertext cannot be decrypted using that key"))).toBe(
      true,
    );
    expect(isAeadAuthFailure(new Error("incorrect key pair for the given ciphertext"))).toBe(true);
    expect(isAeadAuthFailure(new Error("invalid tag"))).toBe(true);
    expect(isAeadAuthFailure(new Error("invalid key length"))).toBe(false);
    expect(isAeadAuthFailure(new Error("input type not yet implemented"))).toBe(false);
  });
});
