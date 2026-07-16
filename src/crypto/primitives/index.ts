// Platform selection for the primitive backend.
//
//   Metro (device)  resolves `index.native.ts` — platform extensions win over
//                   this bare `index.ts`, so the app bundle gets libsodium/JSI +
//                   the native argon2 module and never pulls in the Node-only
//                   hash-wasm / libsodium-wrappers deps.
//   Jest (CI)       resolves `index.node.ts` — jest-expo lists `node` as a
//                   haste platform, so it wins over this file.
//   tsc / anything  else falls through to this file, which forwards to the Node
//                   backend (the CI-provable implementation).
//
// `primitives/resolution.test.ts` asserts Jest actually gets the Node backend.
export * from "./index.node";
