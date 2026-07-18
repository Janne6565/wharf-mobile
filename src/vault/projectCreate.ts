// Client-side crypto for creating a Wharf project. A TypeScript port of
// wharf-web's projectCrypto.buildCreateProject: a project owns one opaque WHARFP
// blob sealed under a random per-project DEK, and that DEK is distributed by
// sealing it (crypto_box_seal) to each member's published X25519 public key. The
// server never sees a DEK or any plaintext — only the ciphertext blob and the
// 80-byte wrapped DEK.
//
// This function is pure (no network, no React): it takes the owner's public key
// and returns the two ciphertext fields to POST /projects, so the crypto is
// unit-tested in isolation (projectCreate.test.ts).

import { randomBytes, sealDek, sealProject, toBase64 } from "@/crypto";
import { emptyProjectPayload } from "./projectDocument";

const PROJECT_DEK_LEN = 32;

// buildCreateProject produces the two ciphertext fields for POST /projects: an
// empty project blob sealed under a fresh DEK, and that DEK sealed to the
// creating owner's own public key (so they can immediately open it back).
export async function buildCreateProject(
  ownerPublicKey: Uint8Array,
): Promise<{ vault: string; wrappedDek: string }> {
  const dek = randomBytes(PROJECT_DEK_LEN);
  const blob = await sealProject(dek, emptyProjectPayload());
  const wrapped = await sealDek(dek, ownerPublicKey);
  return { vault: toBase64(blob), wrappedDek: toBase64(wrapped) };
}
