// Session logic for the terminal screen (component/hook split per REACT.md). Owns
// the connection state machine, the WharfSsh event subscriptions, and the bridge
// to the xterm WebView; the screen stays thin.
//
// State machine: connecting → prompting (hostkey | password | ki) → connected →
// ended {error code | clean}. Cancelling a secret prompt or declining a host key
// ends the flow (canceled / host_key_rejected).
//
// Secret discipline: the per-host stored password is read from the RAW decrypted
// personal payload (vaultSession) ONLY at connect time and handed straight to the
// native engine; a password typed at a prompt lives in a ref that is cleared as
// soon as it is persisted — never in Redux or in long-lived state.

import { useLocalSearchParams, useRouter } from "expo-router";
import { useCallback, useEffect, useRef, useState } from "react";
import { fromBase64, randomBytes, toBase64 } from "@/crypto";
import { useAppSelector } from "@/store/hooks";
import { readProjectStoredPassword } from "@/sync/projectHostSecret";
import { setProjectHostPassword } from "@/sync/projectVaultWrite";
import type { TerminalInbound, TerminalOutbound } from "@/terminal/protocol";
import { useAccentColor } from "@/theme/useAccentColor";
import { hostTarget, type VaultHost } from "@/vault/document";
import { setHostPassword } from "@/vault/hostMutations";
import { readStoredPassword } from "@/vault/hostSecret";
import { readVaultKeyRefs } from "@/vault/keySecret";
import {
  cancelConnect,
  close as closeSession,
  connect,
  parseSshErrorCode,
  resize,
  resolveHostKeyPrompt,
  resolveSecretPrompt,
  type SshClosedEvent,
  type SshDataEvent,
  type SshErrorCode,
  type SshHostKeyPromptEvent,
  type SshSecretPromptEvent,
  type SshSubscription,
  subscribeClosed,
  subscribeData,
  subscribeHostKeyPrompt,
  subscribeSecretPrompt,
  write as writeSession,
} from "../../../modules/wharf-ssh";
import { knownHostsPath } from "./knownHosts";
import {
  ACCESSORY_SEQUENCES,
  type AccessoryKey,
  anyModifierArmed,
  applyModifiers,
  type ModifierKey,
  type Modifiers,
  NO_MODIFIERS,
  toggleModifier,
} from "./lib";
import type { TerminalHandle } from "./TerminalView";
import { useTerminalHtml } from "./useTerminalHtml";

const TERM_TYPE = "xterm-256color";
const CONNECT_TIMEOUT_MS = 15000;
const DEFAULT_COLS = 80;
const DEFAULT_ROWS = 24;
const SESSION_ID_BYTES = 16;

export type TerminalPhase = "connecting" | "connected" | "ended";

function newSessionId(): string {
  let hex = "";
  for (const b of randomBytes(SESSION_ID_BYTES)) {
    hex += b.toString(16).padStart(2, "0");
  }
  return hex;
}

function encodeUtf8(text: string): string {
  return toBase64(new TextEncoder().encode(text));
}

export function useTerminalLogic() {
  const { hostId, projectId } = useLocalSearchParams<{ hostId: string; projectId?: string }>();
  const router = useRouter();
  const accent = useAccentColor();
  const htmlUri = useTerminalHtml();

  const personalHost = useAppSelector((state) => state.vault.hosts.find((h) => h.id === hostId));
  const project = useAppSelector((state) =>
    projectId ? state.projects.projects.find((p) => p.id === projectId) : undefined,
  );
  const host: VaultHost | undefined = projectId
    ? project?.hosts.find((h) => h.id === hostId)
    : personalHost;

  // "Remember password" works for both personal and project hosts. A personal
  // host persists via setHostPassword into the personal vault; a project host
  // writes into the SHARED project vault (setProjectHostPassword), so the
  // remembered password is visible to every member's client — matching the TUI's
  // shared stored-password semantics.
  const canRemember = true;

  const [phase, setPhase] = useState<TerminalPhase>("connecting");
  const [endedError, setEndedError] = useState<SshErrorCode | null>(null);
  const [hostKeyPrompt, setHostKeyPrompt] = useState<SshHostKeyPromptEvent | null>(null);
  const [secretPrompt, setSecretPrompt] = useState<SshSecretPromptEvent | null>(null);
  const [modifiers, setModifiers] = useState<Modifiers>(NO_MODIFIERS);

  const termRef = useRef<TerminalHandle>(null);
  const hostRef = useRef<VaultHost | undefined>(host);
  hostRef.current = host;
  const projectIdRef = useRef<string | undefined>(projectId);
  projectIdRef.current = projectId;
  const sessionIdRef = useRef<string | null>(null);
  const readyRef = useRef(false);
  const writeBufferRef = useRef<TerminalInbound[]>([]);
  const sizeRef = useRef<{ cols: number; rows: number }>({
    cols: DEFAULT_COLS,
    rows: DEFAULT_ROWS,
  });
  const modifiersRef = useRef<Modifiers>(NO_MODIFIERS);
  const rememberRef = useRef<string | null>(null);
  const subsRef = useRef<SshSubscription[]>([]);
  const endedRef = useRef(false);

  useEffect(() => {
    modifiersRef.current = modifiers;
  }, [modifiers]);

  const pushToTerm = useCallback((msg: TerminalInbound) => {
    if (readyRef.current && termRef.current) {
      termRef.current.push(msg);
    } else {
      writeBufferRef.current.push(msg);
    }
  }, []);

  const teardown = useCallback(() => {
    for (const sub of subsRef.current) {
      sub.remove();
    }
    subsRef.current = [];
    const id = sessionIdRef.current;
    sessionIdRef.current = null;
    if (id) {
      // Fire-and-forget both: cancelConnect aborts a still-pending dial/prompt
      // (the engine only registers a session once the shell is up, so close alone
      // would no-op during the connecting phase and leak a shell that completes
      // after teardown); close handles an already-established session. Calling
      // both is safe/idempotent per the engine contract.
      void cancelConnect(id);
      void closeSession(id);
    }
  }, []);

  const endWith = useCallback((error: SshErrorCode | null) => {
    if (endedRef.current) {
      return;
    }
    endedRef.current = true;
    // Drop any typed password so a failed attempt's secret does not outlive it.
    rememberRef.current = null;
    setHostKeyPrompt(null);
    setSecretPrompt(null);
    setEndedError(error);
    setPhase("ended");
  }, []);

  const isCurrent = useCallback((sessionId: string) => sessionId === sessionIdRef.current, []);

  const startSession = useCallback(() => {
    const target = hostRef.current;
    if (!target) {
      return;
    }
    endedRef.current = false;
    rememberRef.current = null;
    setEndedError(null);
    setHostKeyPrompt(null);
    setSecretPrompt(null);
    setPhase("connecting");

    const sessionId = newSessionId();
    sessionIdRef.current = sessionId;

    subsRef.current = [
      subscribeData((event: SshDataEvent) => {
        if (isCurrent(event.sessionId)) {
          pushToTerm({ type: "write", dataB64: event.dataB64 });
        }
      }),
      subscribeClosed((event: SshClosedEvent) => {
        if (isCurrent(event.sessionId)) {
          endWith(event.error === "" ? null : parseSshErrorCode(event.error));
        }
      }),
      subscribeHostKeyPrompt((event: SshHostKeyPromptEvent) => {
        if (isCurrent(event.sessionId)) {
          setHostKeyPrompt(event);
        }
      }),
      subscribeSecretPrompt((event: SshSecretPromptEvent) => {
        if (isCurrent(event.sessionId)) {
          setSecretPrompt(event);
        }
      }),
    ];

    // Resolving a project host's stored password reads the on-disk project cache,
    // so it must happen asynchronously before we dial. A personal host reads the
    // in-memory personal payload synchronously. Any resolution failure degrades to
    // "" and still connects (the engine then prompts).
    const projectId = projectIdRef.current;
    void (async () => {
      const storedPassword = projectId
        ? await readProjectStoredPassword(projectId, target.id)
        : readStoredPassword(target.id);
      // A teardown/reconnect during the async resolution may have retired this
      // session — never dial for a session that is no longer current.
      if (!isCurrent(sessionId) || endedRef.current) {
        return;
      }

      // Auth mode mirrors the TUI: an explicit "password" host is password-only;
      // everything else (mobile-created hosts default to "key"; legacy ""/absent)
      // is key mode. In key mode the caller's synced personal vault keys are
      // offered — for BOTH personal and project hosts, since project hosts use the
      // caller's own keys (private keys are never shared). Password mode offers no
      // keys. The stored password is still passed in key mode: the engine replays
      // it as the password fallback when the synced keys are unusable.
      const authMethod = target.authMethod === "password" ? "password" : "key";
      const keys = authMethod === "key" ? readVaultKeyRefs() : undefined;

      try {
        await connect({
          sessionId,
          host: target.addr,
          port: target.port || 22,
          user: target.user,
          storedPassword,
          termType: TERM_TYPE,
          cols: sizeRef.current.cols,
          rows: sizeRef.current.rows,
          timeoutMs: CONNECT_TIMEOUT_MS,
          knownHostsPath: knownHostsPath(),
          authMethod,
          ...(keys ? { keys } : {}),
        });
      } catch (error: unknown) {
        if (isCurrent(sessionId)) {
          endWith(parseSshErrorCode(error instanceof Error ? error.message : String(error)));
        }
        return;
      }

      if (!isCurrent(sessionId) || endedRef.current) {
        return;
      }
      setPhase("connected");
      const remembered = rememberRef.current;
      rememberRef.current = null;
      if (remembered) {
        // Fire-and-forget: a failed remember just means the next connect prompts.
        // A project host writes into the shared project vault; a personal host into
        // the personal vault.
        if (projectId) {
          void setProjectHostPassword(projectId, target.id, remembered).catch(() => undefined);
        } else {
          void setHostPassword(target.id, remembered).catch(() => undefined);
        }
      }
    })();
  }, [endWith, pushToTerm, isCurrent]);

  // Connect once per host route; tear the session down on unmount / route change.
  // biome-ignore lint/correctness/useExhaustiveDependencies: startSession/teardown are stable and must not re-fire the connect.
  useEffect(() => {
    if (!hostRef.current) {
      return;
    }
    startSession();
    return () => teardown();
  }, [hostId, projectId]);

  const flushWrites = useCallback(() => {
    const buffered = writeBufferRef.current;
    writeBufferRef.current = [];
    for (const msg of buffered) {
      termRef.current?.push(msg);
    }
  }, []);

  const onOutbound = useCallback(
    (msg: TerminalOutbound) => {
      const id = sessionIdRef.current;
      if (msg.type === "ready") {
        readyRef.current = true;
        if (termRef.current) {
          termRef.current.push({ type: "theme", accent });
        }
        flushWrites();
        return;
      }
      if (msg.type === "size") {
        sizeRef.current = { cols: msg.cols, rows: msg.rows };
        if (id) {
          void resize(id, msg.cols, msg.rows);
        }
        return;
      }
      // msg.type === "data": a user keystroke. Apply any armed sticky modifier
      // (ctrl/alt) to the single character, then disarm.
      if (!id) {
        return;
      }
      const mods = modifiersRef.current;
      if (anyModifierArmed(mods)) {
        const decoded = new TextDecoder().decode(fromBase64(msg.dataB64));
        void writeSession(id, encodeUtf8(applyModifiers(decoded, mods)));
        setModifiers(NO_MODIFIERS);
      } else {
        void writeSession(id, msg.dataB64);
      }
    },
    [accent, flushWrites],
  );

  const onAccessoryKey = useCallback((key: AccessoryKey) => {
    const id = sessionIdRef.current;
    if (!id) {
      return;
    }
    const mods = modifiersRef.current;
    void writeSession(id, encodeUtf8(applyModifiers(ACCESSORY_SEQUENCES[key], mods)));
    if (anyModifierArmed(mods)) {
      setModifiers(NO_MODIFIERS);
    }
  }, []);

  const onModifierKey = useCallback((which: ModifierKey) => {
    setModifiers((current) => toggleModifier(current, which));
  }, []);

  const acceptHostKey = useCallback(() => {
    const prompt = hostKeyPrompt;
    setHostKeyPrompt(null);
    if (prompt) {
      void resolveHostKeyPrompt(prompt.promptId, true);
    }
  }, [hostKeyPrompt]);

  const declineHostKey = useCallback(() => {
    const prompt = hostKeyPrompt;
    setHostKeyPrompt(null);
    if (prompt) {
      void resolveHostKeyPrompt(prompt.promptId, false);
    }
  }, [hostKeyPrompt]);

  const submitSecret = useCallback(
    (secret: string, remember: boolean) => {
      const prompt = secretPrompt;
      setSecretPrompt(null);
      if (!prompt) {
        return;
      }
      // canRemember is a constant true (both host kinds can persist). Only a login
      // password is ever persisted — never a keyboard-interactive response and
      // never a key passphrase (a passphrase is not a host secret in v1).
      const isPassword = prompt.kind === "password" || prompt.kind === "password_retry";
      if (isPassword && remember && canRemember) {
        rememberRef.current = secret;
      }
      void resolveSecretPrompt(prompt.promptId, encodeUtf8(secret));
    },
    [secretPrompt],
  );

  const cancelSecret = useCallback(() => {
    const prompt = secretPrompt;
    setSecretPrompt(null);
    if (prompt) {
      void resolveSecretPrompt(prompt.promptId, null);
    }
  }, [secretPrompt]);

  const reconnect = useCallback(() => {
    teardown();
    startSession();
  }, [teardown, startSession]);

  const close = useCallback(() => {
    teardown();
    router.back();
  }, [teardown, router]);

  return {
    htmlUri,
    accent,
    host,
    hostName: host?.name ?? "",
    target: host ? hostTarget(host) : "",
    phase,
    endedError,
    hostKeyPrompt,
    secretPrompt,
    canRemember,
    modifiers,
    termRef,
    onOutbound,
    onAccessoryKey,
    onModifierKey,
    acceptHostKey,
    declineHostKey,
    submitSecret,
    cancelSecret,
    reconnect,
    close,
  };
}
