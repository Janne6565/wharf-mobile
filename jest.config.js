/** @type {import('jest').Config} */
module.exports = {
  preset: "jest-expo",
  setupFilesAfterEnv: ["<rootDir>/jest.setup.js"],
  // Transform the ESM-only packages that ship untranspiled: RN/Expo/NativeWind
  // plus the state/i18n libraries (immer, RTK, react-redux, i18next, TanStack).
  transformIgnorePatterns: [
    "node_modules/(?!((jest-)?react-native|@react-native(-community)?|expo(nent)?|@expo(nent)?/.*|@expo-google-fonts/.*|react-navigation|@react-navigation/.*|@unimodules/.*|unimodules|sentry-expo|native-base|react-native-svg|nativewind|react-native-css-interop|immer|@reduxjs/toolkit|redux|redux-thunk|reselect|react-redux|use-sync-external-store|i18next|react-i18next|@tanstack/.*|lucide-react-native))",
  ],
  moduleNameMapper: {
    "^@/(.*)$": "<rootDir>/src/$1",
  },
  collectCoverageFrom: ["src/**/*.{ts,tsx}", "app/**/*.{ts,tsx}"],
};
