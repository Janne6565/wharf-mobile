// In-memory Jest fake for the `WharfSsh` native module. The jest.config
// moduleNameMapper pins every `modules/wharf-ssh` import to this file, so tests
// (and any code they load) drive a controllable fake instead of touching the
// native bridge — mirroring the `@/crypto/primitives` → `index.node.ts` seam.
//
// It implements the full WharfSshApi with recorded calls, a listener registry,
// and a small control surface (the `__` helpers) tests use to script connect
// outcomes and inject events. Production code never calls the `__` helpers.

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

type Listener<K extends keyof WharfSshEventMap> = (event: WharfSshEventMap[K]) => void;

interface Registry {
  onData: Set<Listener<"onData">>;
  onClosed: Set<Listener<"onClosed">>;
  onHostKeyPrompt: Set<Listener<"onHostKeyPrompt">>;
  onSecretPrompt: Set<Listener<"onSecretPrompt">>;
}

function emptyRegistry(): Registry {
  return {
    onData: new Set(),
    onClosed: new Set(),
    onHostKeyPrompt: new Set(),
    onSecretPrompt: new Set(),
  };
}

// Recorded calls, exposed for assertions.
export interface FakeCalls {
  connect: SshConnectOptions[];
  probe: Array<{ host: string; port: number; timeoutMs: number }>;
  cancelConnect: string[];
  write: Array<{ sessionId: string; dataB64: string }>;
  resize: Array<{ sessionId: string; cols: number; rows: number }>;
  snapshot: string[];
  close: string[];
  closeAll: number;
  resolveHostKeyPrompt: Array<{ promptId: string; accept: boolean }>;
  resolveSecretPrompt: Array<{ promptId: string; secretB64: string | null }>;
}

function emptyCalls(): FakeCalls {
  return {
    connect: [],
    probe: [],
    cancelConnect: [],
    write: [],
    resize: [],
    snapshot: [],
    close: [],
    closeAll: 0,
    resolveHostKeyPrompt: [],
    resolveSecretPrompt: [],
  };
}

let registry = emptyRegistry();
export const __calls: FakeCalls = emptyCalls();

// A deferred that tests settle to control when/whether a connect resolves. When
// unset, connect stays pending (the realistic default: it resolves only once the
// prompt flow completes).
let connectController: { resolve: () => void; reject: (error: Error) => void } | null = null;
let snapshotValue = "";

// What probe() resolves with. Either a fixed RTT (or -1 for unreachable) or a
// per-target function so a test can script different outcomes per host. Defaults
// to -1 (unreachable) so an unconfigured test sees the "offline" path.
let probeResult: number | ((host: string, port: number) => number) = -1;

// __reset clears all state between tests.
export function __reset(): void {
  registry = emptyRegistry();
  Object.assign(__calls, emptyCalls());
  connectController = null;
  snapshotValue = "";
  probeResult = -1;
}

// __emit dispatches an event to the current subscribers.
export function __emit<K extends keyof WharfSshEventMap>(
  eventName: K,
  event: WharfSshEventMap[K],
): void {
  for (const listener of registry[eventName]) {
    (listener as Listener<K>)(event);
  }
}

// __resolveConnect / __rejectConnect settle the pending connect promise.
export function __resolveConnect(): void {
  connectController?.resolve();
  connectController = null;
}

export function __rejectConnect(message: string): void {
  connectController?.reject(new Error(message));
  connectController = null;
}

// __setSnapshot seeds the value the next snapshot() call resolves with.
export function __setSnapshot(value: string): void {
  snapshotValue = value;
}

// __setProbeResult scripts what probe() resolves with — a fixed RTT (or -1 for
// unreachable), or a function computing it from the host/port.
export function __setProbeResult(result: number | ((host: string, port: number) => number)): void {
  probeResult = result;
}

function subscribe<K extends keyof WharfSshEventMap>(
  eventName: K,
  listener: Listener<K>,
): SshSubscription {
  // registry[eventName] is a union of Sets; narrow to this K's Set.
  const set = registry[eventName] as Set<Listener<K>>;
  set.add(listener);
  return {
    remove: () => {
      set.delete(listener);
    },
  };
}

export function connect(opts: SshConnectOptions): Promise<void> {
  __calls.connect.push(opts);
  return new Promise<void>((resolve, reject) => {
    connectController = { resolve, reject };
  });
}

export function probe(host: string, port: number, timeoutMs: number): Promise<number> {
  __calls.probe.push({ host, port, timeoutMs });
  const result = typeof probeResult === "function" ? probeResult(host, port) : probeResult;
  return Promise.resolve(result);
}

export function cancelConnect(sessionId: string): Promise<void> {
  __calls.cancelConnect.push(sessionId);
  return Promise.resolve();
}

export function write(sessionId: string, dataB64: string): Promise<void> {
  __calls.write.push({ sessionId, dataB64 });
  return Promise.resolve();
}

export function resize(sessionId: string, cols: number, rows: number): Promise<void> {
  __calls.resize.push({ sessionId, cols, rows });
  return Promise.resolve();
}

export function snapshot(sessionId: string): Promise<string> {
  __calls.snapshot.push(sessionId);
  return Promise.resolve(snapshotValue);
}

export function close(sessionId: string): Promise<void> {
  __calls.close.push(sessionId);
  return Promise.resolve();
}

export function closeAll(): Promise<void> {
  __calls.closeAll += 1;
  return Promise.resolve();
}

export function resolveHostKeyPrompt(promptId: string, accept: boolean): Promise<void> {
  __calls.resolveHostKeyPrompt.push({ promptId, accept });
  return Promise.resolve();
}

export function resolveSecretPrompt(promptId: string, secretB64: string | null): Promise<void> {
  __calls.resolveSecretPrompt.push({ promptId, secretB64 });
  return Promise.resolve();
}

export function subscribeData(listener: (event: SshDataEvent) => void): SshSubscription {
  return subscribe("onData", listener);
}

export function subscribeClosed(listener: (event: SshClosedEvent) => void): SshSubscription {
  return subscribe("onClosed", listener);
}

export function subscribeHostKeyPrompt(
  listener: (event: SshHostKeyPromptEvent) => void,
): SshSubscription {
  return subscribe("onHostKeyPrompt", listener);
}

export function subscribeSecretPrompt(
  listener: (event: SshSecretPromptEvent) => void,
): SshSubscription {
  return subscribe("onSecretPrompt", listener);
}

// Compile-time proof the fake satisfies the same contract as the native wrapper.
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
