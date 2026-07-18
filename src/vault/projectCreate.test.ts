import { fromBase64, generateKeypair, openDek, openProject } from "@/crypto";
import { buildCreateProject } from "./projectCreate";

describe("buildCreateProject", () => {
  it("produces an empty project blob and a DEK the owner can unwrap and open", async () => {
    const { publicKey, privateKey } = await generateKeypair();

    const { vault, wrappedDek } = await buildCreateProject(publicKey);

    // The wrapped DEK is exactly 80 bytes (sealed box) and the owner can unwrap it.
    expect(fromBase64(wrappedDek)).toHaveLength(80);
    const dek = await openDek(fromBase64(wrappedDek), publicKey, privateKey);

    // The unwrapped DEK opens the blob to the canonical empty project document.
    const payload = await openProject(dek, fromBase64(vault));
    expect(new TextDecoder().decode(payload)).toBe('{"schema":1,"hosts":[]}');
  });
});
