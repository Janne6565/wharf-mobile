// Jest setup: mocks for native-only modules that have no JS implementation under
// the Node test runner. (@testing-library/react-native v14 auto-extends the jest
// matchers, so no extend-expect import is needed.)

// AsyncStorage ships a Jest mock; wire it up so i18n persistence is testable.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);
