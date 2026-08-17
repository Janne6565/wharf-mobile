import { render, screen } from "@testing-library/react-native";
import { Text } from "react-native";
import { ScreenContainer } from "./ScreenContainer";

// The screens in this app are columns of cards whose height depends on how many
// hosts, keys or projects the user has. A non-scrolling container truncates
// those lists with no affordance — the rows that fit look like the whole list —
// which is exactly how the hosts and keys tabs shipped unreachable rows.
describe("ScreenContainer", () => {
  it("scrolls its content by default", async () => {
    await render(
      <ScreenContainer>
        <Text>row</Text>
      </ScreenContainer>,
    );
    expect(screen.getByTestId("screen-scroll")).toBeTruthy();
  });

  it("renders no scroll view when the screen brings its own", async () => {
    await render(
      <ScreenContainer scrollable={false}>
        <Text>row</Text>
      </ScreenContainer>,
    );
    expect(screen.queryByTestId("screen-scroll")).toBeNull();
    expect(screen.getByText("row")).toBeTruthy();
  });

  it("keeps taps working while the keyboard is up", async () => {
    await render(
      <ScreenContainer>
        <Text>row</Text>
      </ScreenContainer>,
    );
    // Without this, the first tap on a row is spent dismissing the search
    // keyboard instead of opening the host.
    expect(screen.getByTestId("screen-scroll").props.keyboardShouldPersistTaps).toBe("handled");
  });

  it("lets short screens fill the viewport and long ones grow past it", async () => {
    await render(
      <ScreenContainer>
        <Text>row</Text>
      </ScreenContainer>,
    );
    // flexGrow, not flex: `flex: 1` would cap the content at the viewport
    // height and bring the truncation back.
    const style = screen.getByTestId("screen-scroll").props.contentContainerStyle;
    expect(style.flexGrow).toBe(1);
  });
});
