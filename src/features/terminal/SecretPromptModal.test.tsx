import "@/i18n/config";
import { screen } from "@testing-library/react-native";
import { renderWithProviders } from "@/test/renderWithProviders";
import type { SshSecretPromptEvent } from "../../../modules/wharf-ssh";
import { SecretPromptModal } from "./SecretPromptModal";

const passwordPrompt: SshSecretPromptEvent = {
  promptId: "p1",
  sessionId: "s1",
  kind: "password",
  prompt: "",
  echo: false,
};

const kiPrompt: SshSecretPromptEvent = {
  promptId: "p2",
  sessionId: "s1",
  kind: "ki",
  prompt: "Verification code:",
  echo: true,
};

describe("SecretPromptModal", () => {
  it("shows the remember toggle for a password prompt when the host can persist", async () => {
    await renderWithProviders(
      <SecretPromptModal
        prompt={passwordPrompt}
        canRemember
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("terminal-secret-remember")).not.toBeNull();
  });

  it("hides the remember toggle when the host cannot persist (project host)", async () => {
    await renderWithProviders(
      <SecretPromptModal
        prompt={passwordPrompt}
        canRemember={false}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.queryByTestId("terminal-secret-remember")).toBeNull();
  });

  it("never shows the remember toggle for a keyboard-interactive prompt", async () => {
    await renderWithProviders(
      <SecretPromptModal prompt={kiPrompt} canRemember onSubmit={jest.fn()} onCancel={jest.fn()} />,
    );
    expect(screen.queryByTestId("terminal-secret-remember")).toBeNull();
  });

  it("still renders the secret input when the remember toggle is hidden", async () => {
    await renderWithProviders(
      <SecretPromptModal
        prompt={passwordPrompt}
        canRemember={false}
        onSubmit={jest.fn()}
        onCancel={jest.fn()}
      />,
    );
    expect(screen.getByTestId("terminal-secret-input")).toBeTruthy();
    expect(screen.getByTestId("terminal-secret-submit")).toBeTruthy();
  });
});
