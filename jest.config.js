/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // Transform the ESM-only packages that ship untranspiled: RN/Expo/NativeWind
  // plus the state/i18n libraries (immer, RTK, react-redux, i18next, TanStack).
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|immer|@reduxjs/toolkit|redux|redux-thunk|reselect|react-redux|use-sync-external-store|i18next|react-i18next|@tanstack/.*|lucide-react-native|@noble/hashes|@noble/ciphers|@noble/curves))",
  ],
  moduleNameMapper: {
    // Force the Node primitive backend under Jest. jest-expo (like Metro) resolves
    // `.native.ts` by default, but the native backend needs libsodium JSI + the
    // wharf-argon2 native module, which cannot run under Node. These two mappings
    // pin every import of the primitives barrel to index.node.ts (hash-wasm +
    // libsodium-wrappers + WebCrypto). Metro still resolves index.native.ts on
    // device — proven by the on-device crypto self-test, not by CI. Order matters:
    // these must precede the generic `@/` alias.
    "^@/crypto/primitives$": "<rootDir>/src/crypto/primitives/index.node.ts",
    "^\\./primitives$": "<rootDir>/src/crypto/primitives/index.node.ts",
    // The WharfSsh native module wraps requireNativeModule, which cannot run
    // under Node. Pin every `modules/wharf-ssh` import (relative, from any depth)
    // to the in-memory fake — same seam idea as the crypto primitives above.
    // Metro/tsc still resolve modules/wharf-ssh/index.ts on device.
    "modules/wharf-ssh$": "<rootDir>/modules/wharf-ssh/index.node.ts",
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
};
