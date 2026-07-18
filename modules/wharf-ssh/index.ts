// JS surface of the `WharfSsh` local Expo module: a thin, typed wrapper over the
// gomobile-compiled SSH engine (native Swift/Kotlin, added later by the
// native-bridge agent). Everything here just forwards to the native module or
// wires an Expo event subscription — no logic lives on this side.
//
// The module is only present in a native dev-client build (its native code is
// compiled by `expo prebuild` + the app build). Jest never imports this file: the
// jest.config moduleNameMapper pins every `modules/wharf-ssh` import to the
// in-memory fake in `index.node.ts` (same seam pattern as `@/crypto/primitives`),
// so the test runner never calls `requireNativeModule`.

import { requireNativeModule } from "expo-modules-core";
import type {
  SshClosedEvent,
  SshConnectOptions,
  SshDataEvent,
  SshHostKeyPromptEvent,
  SshSecretPromptEvent,
  SshSubscription,
  WharfSshApi,
  WharfSshEventMap,
} from "./contract";

export * from "./contract";

// The native module both resolves promises and emits the four events. Expo's
// NativeModule exposes `addListener(eventName, listener): EventSubscription`.
interface WharfSshNative {
  connect(opts: SshConnectOptions): Promise<void>;
  probe(host: string, port: number, timeoutMs: number): Promise<number>;
  cancelConnect(sessionId: string): Promise<void>;
  write(sessionId: string, dataB64: string): Promise<void>;
  resize(sessionId: string, cols: number, rows: number): Promise<void>;
  snapshot(sessionId: string): Promise<string>;
  close(sessionId: string): Promise<void>;
  closeAll(): Promise<void>;
  resolveHostKeyPrompt(promptId: string, accept: boolean): Promise<void>;
  resolveSecretPrompt(promptId: string, secretB64: string | null): Promise<void>;
  addListener<K extends keyof WharfSshEventMap>(
    eventName: K,
    listener: (event: WharfSshEventMap[K]) => void,
  ): SshSubscription;
}

const native = requireNativeModule<WharfSshNative>("WharfSsh");

export function connect(opts: SshConnectOptions): Promise<void> {
  return native.connect(opts);
}

export function probe(host: string, port: number, timeoutMs: number): Promise<number> {
  return native.probe(host, port, timeoutMs);
}

export function cancelConnect(sessionId: string): Promise<void> {
  return native.cancelConnect(sessionId);
}

export function write(sessionId: string, dataB64: string): Promise<void> {
  return native.write(sessionId, dataB64);
}

export function resize(sessionId: string, cols: number, rows: number): Promise<void> {
  return native.resize(sessionId, cols, rows);
}

export function snapshot(sessionId: string): Promise<string> {
  return native.snapshot(sessionId);
}

export function close(sessionId: string): Promise<void> {
  return native.close(sessionId);
}

export function closeAll(): Promise<void> {
  return native.closeAll();
}

export function resolveHostKeyPrompt(promptId: string, accept: boolean): Promise<void> {
  return native.resolveHostKeyPrompt(promptId, accept);
}

export function resolveSecretPrompt(promptId: string, secretB64: string | null): Promise<void> {
  return native.resolveSecretPrompt(promptId, secretB64);
}

export function subscribeData(listener: (event: SshDataEvent) => void): SshSubscription {
  return native.addListener("onData", listener);
}

export function subscribeClosed(listener: (event: SshClosedEvent) => void): SshSubscription {
  return native.addListener("onClosed", listener);
}

export function subscribeHostKeyPrompt(
  listener: (event: SshHostKeyPromptEvent) => void,
): SshSubscription {
  return native.addListener("onHostKeyPrompt", listener);
}

export function subscribeSecretPrompt(
  listener: (event: SshSecretPromptEvent) => void,
): SshSubscription {
  return native.addListener("onSecretPrompt", listener);
}

// Compile-time proof this wrapper satisfies the shared contract.
const _api: WharfSshApi = {
  connect,
  probe,
  cancelConnect,
  write,
  resize,
  snapshot,
  close,
  closeAll,
  resolveHostKeyPrompt,
  resolveSecretPrompt,
  subscribeData,
  subscribeClosed,
  subscribeHostKeyPrompt,
  subscribeSecretPrompt,
};
void _api;
