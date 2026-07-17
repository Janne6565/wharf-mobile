import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import { setHostPassword } from "@/vault/hostMutations";
import { readStoredPassword } from "@/vault/hostSecret";
// The control surface lives only on the fake; import it from the fake file
// directly (the barrel's type surface, which the hook uses, is re-exported here
// too). At runtime jest resolves this to the same module instance the hook loads.
import {
  __calls,
  __emit,
  __rejectConnect,
  __reset,
  __resolveConnect,
  type SshSecretPromptEvent,
} from "../../../modules/wharf-ssh/index.node";
import { useTerminalLogic } from "./useTerminalLogic";

// expo-router params + navigation. `mockParams` is mutable so a test can open the
// same host via a project (adds projectId) instead of the personal vault.
let mockParams: { hostId: string; projectId?: string } = { hostId: "h1" };
jest.mock("expo-router", () => ({
  useLocalSearchParams: () => mockParams,
  useRouter: () => ({ back: jest.fn() }),
}));
// Avoid expo-file-system / expo-asset native deps under Node.
jest.mock("./knownHosts", () => ({ knownHostsPath: () => "/doc/known_hosts" }));
jest.mock("./useTerminalHtml", () => ({ useTerminalHtml: () => "file:///terminal.html" }));
// Isolate the vault side effects; extractStoredPassword + setHostPasswordInPayload
// preservation are covered by hostSecret.test / mutate.test.
jest.mock("@/vault/hostSecret", () => ({ readStoredPassword: jest.fn(() => "") }));
jest.mock("@/vault/hostMutations", () => ({
  setHostPassword: jest.fn(() => Promise.resolve()),
}));

const mockedReadStoredPassword = readStoredPassword as jest.MockedFunction<
  typeof readStoredPassword
>;
const mockedSetHostPassword = setHostPassword as jest.MockedFunction<typeof setHostPassword>;

const b64 = (s: string) => Buffer.from(s, "utf8").toString("base64");

function wrapper({ children }: { readonly children: ReactNode }) {
  return (
    <Provider store={store}>
      <QueryClientProvider client={queryClient}>{children}</QueryClientProvider>
    </Provider>
  );
}

async function mount() {
  const rendered = await renderHook(() => useTerminalLogic(), { wrapper });
  await waitFor(() => expect(__calls.connect.length).toBe(1));
  return rendered;
}

const currentSessionId = () => __calls.connect[__calls.connect.length - 1].sessionId;

async function emitSecretPrompt(prompt: Omit<SshSecretPromptEvent, "sessionId">) {
  await act(async () => {
    __emit("onSecretPrompt", { ...prompt, sessionId: currentSessionId() });
  });
}

describe("useTerminalLogic", () => {
  beforeEach(() => {
    jest.clearAllMocks();
    __reset();
    mockParams = { hostId: "h1" };
    mockedReadStoredPassword.mockReturnValue("");
    store.dispatch(vaultLocked());
    store.dispatch(projectsReset());
    store.dispatch(
      vaultUnlocked({
        hosts: [{ id: "h1", name: "prod-api-01", user: "deniz", addr: "prod.io", port: 22 }],
        version: 0,
      }),
    );
  });

  it("connects on mount with the host + stored password, then reaches connected", async () => {
    mockedReadStoredPassword.mockReturnValue("stored-pw");
    const { result } = await mount();

    expect(result.current.phase).toBe("connecting");
    expect(__calls.connect[0]).toMatchObject({
      host: "prod.io",
      port: 22,
      user: "deniz",
      storedPassword: "stored-pw",
      termType: "xterm-256color",
      knownHostsPath: "/doc/known_hosts",
    });

    await act(async () => {
      __resolveConnect();
    });
    await waitFor(() => expect(result.current.phase).toBe("connected"));
  });

  it("ends with host_key_rejected when the host key is declined", async () => {
    const { result } = await mount();

    await act(async () => {
      __emit("onHostKeyPrompt", {
        promptId: "p1",
        sessionId: currentSessionId(),
        host: "prod.io",
        keyType: "ssh-ed25519",
        fingerprint: "SHA256:abcd",
      });
    });
    await waitFor(() => expect(result.current.hostKeyPrompt).not.toBeNull());

    await act(async () => {
      result.current.declineHostKey();
    });
    expect(__calls.resolveHostKeyPrompt[0]).toEqual({ promptId: "p1", accept: false });

    await act(async () => {
      __rejectConnect("host_key_rejected: user declined");
    });
    await waitFor(() => {
      expect(result.current.phase).toBe("ended");
      expect(result.current.endedError).toBe("host_key_rejected");
    });
  });

  it("re-prompts on password retry and resolves with the base64 secret", async () => {
    const { result } = await mount();

    await emitSecretPrompt({ promptId: "s1", kind: "password_retry", prompt: "", echo: false });
    await waitFor(() => expect(result.current.secretPrompt?.kind).toBe("password_retry"));

    await act(async () => {
      result.current.submitSecret("hunter2", false);
    });
    expect(__calls.resolveSecretPrompt[0]).toEqual({ promptId: "s1", secretB64: b64("hunter2") });
    expect(result.current.secretPrompt).toBeNull();
  });

  it("persists a remembered password only after the connect succeeds", async () => {
    const { result } = await mount();

    await emitSecretPrompt({ promptId: "s2", kind: "password", prompt: "", echo: false });
    await waitFor(() => expect(result.current.secretPrompt?.kind).toBe("password"));

    await act(async () => {
      result.current.submitSecret("s3cret", true);
    });
    // Not persisted yet — the connection has not succeeded.
    expect(mockedSetHostPassword).not.toHaveBeenCalled();

    await act(async () => {
      __resolveConnect();
    });
    await waitFor(() => expect(result.current.phase).toBe("connected"));
    // setHostPassword(hostId, password) runs the raw-preserving mutation
    // (mutate.test proves unknown fields survive).
    await waitFor(() => expect(mockedSetHostPassword).toHaveBeenCalledWith("h1", "s3cret"));
  });

  it("does not persist when 'remember' is unticked", async () => {
    const { result } = await mount();

    await emitSecretPrompt({ promptId: "s3", kind: "password", prompt: "", echo: false });
    await waitFor(() => expect(result.current.secretPrompt?.kind).toBe("password"));
    await act(async () => {
      result.current.submitSecret("s3cret", false);
    });

    await act(async () => {
      __resolveConnect();
    });
    await waitFor(() => expect(result.current.phase).toBe("connected"));
    expect(mockedSetHostPassword).not.toHaveBeenCalled();
  });

  it("cancels and closes the in-flight session on teardown while connecting", async () => {
    const rendered = await mount();
    const sessionId = currentSessionId();
    expect(rendered.result.current.phase).toBe("connecting");

    // Unmount (route change) while the dial is still pending. close alone would
    // no-op here — the engine only registers the session once the shell is up —
    // so teardown must also cancelConnect to abort the pending dial/prompt.
    await act(async () => {
      rendered.unmount();
    });

    expect(__calls.cancelConnect).toContain(sessionId);
    expect(__calls.close).toContain(sessionId);
  });

  it("offers remember for a personal host", async () => {
    const { result } = await mount();
    expect(result.current.canRemember).toBe(true);
  });

  it("hides remember and never persists the secret for a project host", async () => {
    mockParams = { hostId: "h1", projectId: "proj-1" };
    store.dispatch(
      projectsLoaded({
        offline: false,
        invites: [],
        projects: [
          {
            id: "proj-1",
            name: "team",
            description: "",
            role: "MEMBER",
            memberCount: 1,
            pendingInviteCount: 0,
            version: 0,
            awaiting: false,
            hosts: [{ id: "h1", name: "prod-api-01", user: "deniz", addr: "prod.io", port: 22 }],
          },
        ],
      }),
    );

    const { result } = await mount();
    expect(result.current.canRemember).toBe(false);

    await emitSecretPrompt({ promptId: "s4", kind: "password", prompt: "", echo: false });
    await waitFor(() => expect(result.current.secretPrompt?.kind).toBe("password"));
    await act(async () => {
      result.current.submitSecret("s3cret", true);
    });

    await act(async () => {
      __resolveConnect();
    });
    await waitFor(() => expect(result.current.phase).toBe("connected"));
    // "remember" was ticked, but a project host cannot persist into the personal
    // vault — so the tick is dropped, not silently no-oped after the fact.
    expect(mockedSetHostPassword).not.toHaveBeenCalled();
  });

  it("forwards user keystrokes to write and size messages to resize", async () => {
    const { result } = await mount();
    const sessionId = currentSessionId();

    await act(async () => {
      result.current.onOutbound({ type: "data", dataB64: b64("ls\n") });
    });
    expect(__calls.write.at(-1)).toEqual({ sessionId, dataB64: b64("ls\n") });

    await act(async () => {
      result.current.onOutbound({ type: "size", cols: 100, rows: 30 });
    });
    expect(__calls.resize.at(-1)).toEqual({ sessionId, cols: 100, rows: 30 });
  });

  it("applies a sticky ctrl modifier to the next keystroke, then disarms", async () => {
    const { result } = await mount();
    const sessionId = currentSessionId();

    await act(async () => {
      result.current.onModifierKey("ctrl");
    });
    expect(result.current.modifiers.ctrl).toBe(true);

    await act(async () => {
      result.current.onOutbound({ type: "data", dataB64: b64("c") });
    });
    expect(__calls.write.at(-1)).toEqual({ sessionId, dataB64: b64("\x03") }); // Ctrl-C
    expect(result.current.modifiers.ctrl).toBe(false);
  });
});
