import { QueryClientProvider } from "@tanstack/react-query";
import { act, renderHook, waitFor } from "@testing-library/react-native";
import type { ReactNode } from "react";
import { Provider } from "react-redux";
import { queryClient } from "@/query/queryClient";
import { store } from "@/store";
import { projectsLoaded, projectsReset } from "@/store/projectsSlice";
import { vaultLocked, vaultUnlocked } from "@/store/vaultSlice";
import { readProjectStoredPassword } from "@/sync/projectHostSecret";
import { setProjectHostPassword } from "@/sync/projectVaultWrite";
import { setHostPassword } from "@/vault/hostMutations";
import { readStoredPassword } from "@/vault/hostSecret";
import { readVaultKeyRefs } from "@/vault/keySecret";
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
// Synced key material is read transiently at connect time (covered in
// keySecret.test); mock it here to assert the key-mode connect wiring.
jest.mock("@/vault/keySecret", () => ({ readVaultKeyRefs: jest.fn(() => []) }));
// A project host's stored password is resolved from the on-disk project cache
// (covered in projectHostSecret.test); mock it here to assert the connect wiring.
jest.mock("@/sync/projectHostSecret", () => ({
  readProjectStoredPassword: jest.fn(() => Promise.resolve("")),
}));
jest.mock("@/vault/hostMutations", () => ({
  setHostPassword: jest.fn(() => Promise.resolve()),
}));
// A project host's remembered password is persisted into the shared project vault
// (covered in projectVaultWrite.test); mock it here to assert the connect wiring.
jest.mock("@/sync/projectVaultWrite", () => ({
  setProjectHostPassword: jest.fn(() => Promise.resolve()),
}));

const mockedReadStoredPassword = readStoredPassword as jest.MockedFunction<
  typeof readStoredPassword
>;
const mockedReadVaultKeyRefs = readVaultKeyRefs as jest.MockedFunction<typeof readVaultKeyRefs>;
const mockedReadProjectStoredPassword = readProjectStoredPassword as jest.MockedFunction<
  typeof readProjectStoredPassword
>;
const mockedSetHostPassword = setHostPassword as jest.MockedFunction<typeof setHostPassword>;
const mockedSetProjectHostPassword = setProjectHostPassword as jest.MockedFunction<
  typeof setProjectHostPassword
>;

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
    mockedReadProjectStoredPassword.mockResolvedValue("");
    mockedReadVaultKeyRefs.mockReturnValue([]);
    store.dispatch(vaultLocked());
    store.dispatch(projectsReset());
    store.dispatch(
      vaultUnlocked({
        hosts: [{ id: "h1", name: "prod-api-01", user: "deniz", addr: "prod.io", port: 22 }],
        keys: [],
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
    // (mutate.test proves unknown fields survive). The personal path never touches
    // the shared project vault.
    await waitFor(() => expect(mockedSetHostPassword).toHaveBeenCalledWith("h1", "s3cret"));
    expect(mockedSetProjectHostPassword).not.toHaveBeenCalled();
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

  it("persists a remembered project-host password into the shared project vault", async () => {
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
    // A project host can now remember its password.
    expect(result.current.canRemember).toBe(true);

    await emitSecretPrompt({ promptId: "s4", kind: "password", prompt: "", echo: false });
    await waitFor(() => expect(result.current.secretPrompt?.kind).toBe("password"));
    await act(async () => {
      result.current.submitSecret("s3cret", true);
    });

    await act(async () => {
      __resolveConnect();
    });
    await waitFor(() => expect(result.current.phase).toBe("connected"));
    // The remembered password is written to the shared project vault — not the
    // personal one.
    await waitFor(() =>
      expect(mockedSetProjectHostPassword).toHaveBeenCalledWith("proj-1", "h1", "s3cret"),
    );
    expect(mockedSetHostPassword).not.toHaveBeenCalled();
  });

  it("connects a project host with the password resolved from the project cache", async () => {
    mockParams = { hostId: "h1", projectId: "proj-1" };
    mockedReadProjectStoredPassword.mockResolvedValue("project-pw");
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

    // The project path is used (not the personal one), and its resolved password
    // is what reaches the native connect call.
    expect(mockedReadProjectStoredPassword).toHaveBeenCalledWith("proj-1", "h1");
    expect(mockedReadStoredPassword).not.toHaveBeenCalled();
    expect(__calls.connect[0]).toMatchObject({ storedPassword: "project-pw" });

    await act(async () => {
      __resolveConnect();
    });
    await waitFor(() => expect(result.current.phase).toBe("connected"));
  });

  it("connects a personal host with the synchronous readStoredPassword", async () => {
    mockedReadStoredPassword.mockReturnValue("personal-pw");
    await mount();

    expect(mockedReadStoredPassword).toHaveBeenCalledWith("h1");
    expect(mockedReadProjectStoredPassword).not.toHaveBeenCalled();
    expect(__calls.connect[0]).toMatchObject({ storedPassword: "personal-pw" });
  });

  it("connects a key-mode host with authMethod 'key' and the synced key refs", async () => {
    // The seed host in beforeEach has no authMethod → key mode (matching the TUI's
    // legacy default). The synced vault keys are offered in key mode.
    const KEYS = [{ name: "id_ed25519", materialB64: "bWF0" }];
    mockedReadVaultKeyRefs.mockReturnValue(KEYS);

    await mount();

    expect(mockedReadVaultKeyRefs).toHaveBeenCalled();
    expect(__calls.connect[0]).toMatchObject({ authMethod: "key", keys: KEYS });
  });

  it("connects a password-mode host with authMethod 'password' and no keys", async () => {
    mockedReadVaultKeyRefs.mockReturnValue([{ name: "id_ed25519", materialB64: "bWF0" }]);
    store.dispatch(
      vaultUnlocked({
        hosts: [
          {
            id: "h1",
            name: "prod-api-01",
            user: "deniz",
            addr: "prod.io",
            port: 22,
            authMethod: "password",
          },
        ],
        keys: [],
        version: 0,
      }),
    );

    await mount();

    expect(__calls.connect[0]).toMatchObject({ authMethod: "password" });
    expect(__calls.connect[0].keys).toBeUndefined();
    // Password mode never reads the synced key material.
    expect(mockedReadVaultKeyRefs).not.toHaveBeenCalled();
  });

  it("connects a key-mode project host with the caller's synced keys", async () => {
    const KEYS = [{ name: "id_ed25519", materialB64: "bWF0" }];
    mockedReadVaultKeyRefs.mockReturnValue(KEYS);
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

    await mount();

    // A project host still uses the caller's own personal synced keys.
    expect(__calls.connect[0]).toMatchObject({ authMethod: "key", keys: KEYS });
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
