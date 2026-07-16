// Jest setup: mocks for native-only modules that have no JS implementation under
// the Node test runner. (@testing-library/react-native v14 auto-extends the jest
// matchers, so no extend-expect import is needed.)

// AsyncStorage ships a Jest mock; wire it up so i18n persistence is testable.
jest.mock("@react-native-async-storage/async-storage", () =>
  require("@react-native-async-storage/async-storage/jest/async-storage-mock"),
);

// jest-expo's Modal renders null, so a component tree inside a <Modal> (our Sheet,
// used by the invite flow) is invisible to Testing Library. Replace it with a
// pass-through that honours `visible`, so sheet contents are queryable when open
// and correctly absent when closed — without altering on-device behaviour.
jest.mock("react-native/Libraries/Modal/Modal", () => {
  // Return children directly (no JSX/createElement) so the NativeWind babel
  // transform doesn't inject its interop helper into this hoisted factory.
  // Exposed as both the function and `.default` since the RN module is a default
  // export, and given a displayName so Testing Library's host config accepts it.
  const MockModal = (props) => (props.visible === false ? null : props.children);
  MockModal.displayName = "Modal";
  MockModal.default = MockModal;
  return MockModal;
});
