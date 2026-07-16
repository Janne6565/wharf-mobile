import { PRIMITIVES_BACKEND } from "@/crypto/primitives";

// Guards the platform-resolution contract: under Jest the primitives barrel must
// resolve the Node backend (index.node.ts), NOT the native one — otherwise the
// fixtures would exercise libsodium JSI / the native argon2 module, which cannot
// run under Node, and CI would silently stop proving byte-compatibility. jest-expo
// (like Metro) prefers `.native.ts`, so jest.config.js pins this import via
// moduleNameMapper; this test fails loudly if that pin is ever removed. Metro's
// `.native.ts` resolution on device is proven by the on-device self-test instead.
describe("primitive backend resolution", () => {
  it("resolves the Node backend under Jest", () => {
    expect(PRIMITIVES_BACKEND).toBe("node");
  });
});
