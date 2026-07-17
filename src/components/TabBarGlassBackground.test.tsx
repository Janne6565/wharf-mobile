import { render } from "@testing-library/react-native";
import { StyleSheet } from "react-native";
import { TabBarGlassBackground } from "./TabBarGlassBackground";

// expo-glass-effect is mocked in jest.setup.js, so GlassView renders as a plain
// View under Node. This asserts the glass background renders and fills its host
// (the absolutely-positioned tab bar) via StyleSheet.absoluteFill.
describe("TabBarGlassBackground", () => {
  it("renders a layer that fills the tab bar", async () => {
    const tree = (await render(<TabBarGlassBackground />)).toJSON();

    expect(tree).not.toBeNull();
    expect(tree).not.toBeInstanceOf(Array);
    if (tree === null || Array.isArray(tree)) return;
    expect(tree.props.style).toEqual(StyleSheet.absoluteFill);
  });
});
