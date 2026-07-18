import { render, screen } from "@testing-library/react-native";
import { Switch } from "react-native";
import { SettingsRow } from "./SettingsRow";

// lucide-react-native icons render as an <RNSVGSvgView>; the chevron is the only
// icon a bare SettingsRow renders, so its presence in the tree means "chevron shown".
function hasChevron() {
  return JSON.stringify(screen.toJSON()).includes("RNSVGSvgView");
}

describe("SettingsRow", () => {
  it("renders the label and value", async () => {
    await render(<SettingsRow label="Language" value="EN" />);
    expect(screen.getByText("Language")).toBeTruthy();
    expect(screen.getByText("EN")).toBeTruthy();
  });

  it("shows no chevron on a pressable row by default (tappable is not navigation)", async () => {
    await render(<SettingsRow label="Lock vault" onPress={() => {}} />);
    expect(hasChevron()).toBe(false);
  });

  it("shows a chevron only when opted in", async () => {
    await render(<SettingsRow label="Language" value="EN" onPress={() => {}} chevron />);
    expect(hasChevron()).toBe(true);
  });

  it("styles the label in the danger colour when danger is set", async () => {
    await render(<SettingsRow label="Sign out" onPress={() => {}} danger />);
    expect(screen.getByText("Sign out").props.className).toContain("text-danger");
  });

  it("uses the foreground colour for the label by default", async () => {
    await render(<SettingsRow label="Email" value="me@acme.io" />);
    const className = screen.getByText("Email").props.className as string;
    expect(className).toContain("text-fg");
    expect(className).not.toContain("text-danger");
  });

  it("suppresses the chevron when an accessory is present", async () => {
    await render(
      <SettingsRow label="Biometric unlock" onPress={() => {}} chevron accessory={<Switch />} />,
    );
    expect(hasChevron()).toBe(false);
  });
});
