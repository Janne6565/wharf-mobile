// The cryptographic-primitive contract shared by every platform backend. The
// crypto layer above this file (wharfv, wharfp, x25519, keys) is a verbatim
// port of wharf-web and depends ONLY on these signatures, never on a concrete
// backend. Two implementations satisfy it:
//
//   index.node.ts   — hash-wasm + libsodium-wrappers + WebCrypto (Jest/CI).
//   index.native.ts — react-native-libsodium + a native argon2 module +
//                      @noble/hashes (device / Metro bundle).
//
// Metro resolves index.native.ts on device; Jest resolves index.node.ts; tsc
// and the barrel fall back to the node implementation. Keeping the contract in
// one file lets each backend assert conformance at compile time
// (`const _contract: CryptoPrimitives = { ... }`).

// Argon2id cost parameters. Byte-for-byte the same values Go's
// argon2.IDKey(secret, salt, time, memoryKiB, parallelism, 32) records.
export interface Argon2Params {
  readonly iterations: number;
  readonly memoryKiB: number;
  readonly parallelism: number;
}

// The full primitive surface. Both backends export functions with these exact
// signatures; the reference argon2/box functions match wharf-web's primitives.ts.
export interface CryptoPrimitives {
  // deriveArgon2id derives a 32-byte key. secret and salt are raw bytes so this
  // matches Go's argon2.IDKey(secret, salt, ...) exactly — including a binary
  // recovery secret that is not valid UTF-8 (why a string-password argon2 API
  // is unusable and a bytes-in native module is required).
  deriveArgon2id(secret: Uint8Array, salt: Uint8Array, params: Argon2Params): Promise<Uint8Array>;

  sha256(data: Uint8Array): Promise<Uint8Array>;

  // hkdfSha256 uses an empty salt (HMAC key of HashLen zero bytes), matching the
  // client-only determinism the server contract relies on.
  hkdfSha256(ikm: Uint8Array, info: string, length?: number): Promise<Uint8Array>;

  xchachaSeal(
    key: Uint8Array,
    nonce: Uint8Array,
    plaintext: Uint8Array,
    aad: Uint8Array | null,
  ): Promise<Uint8Array>;

  // xchachaOpen returns null on authentication failure (rather than throwing) so
  // callers can map it to the appropriate wrong-secret / corrupt error.
  xchachaOpen(
    key: Uint8Array,
    nonce: Uint8Array,
    ciphertext: Uint8Array,
    aad: Uint8Array | null,
  ): Promise<Uint8Array | null>;

  randomBytes(length: number): Uint8Array;

  boxKeypair(): Promise<{ publicKey: Uint8Array; privateKey: Uint8Array }>;

  boxSeal(message: Uint8Array, recipientPub: Uint8Array): Promise<Uint8Array>;

  // boxSealOpen returns null on failure (wrong recipient or tampering) rather
  // than throwing, mirroring xchachaOpen.
  boxSealOpen(
    sealed: Uint8Array,
    publicKey: Uint8Array,
    privateKey: Uint8Array,
  ): Promise<Uint8Array | null>;
}

// A marker each backend exports so tests (and the on-device self-test) can
// confirm which implementation the platform resolved.
export type PrimitivesBackend = "node" | "native";
