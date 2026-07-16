import { useCallback, useEffect, useRef, useState } from "react";
import {
  createVault,
  decodeCrockford,
  deriveAuthKey,
  deriveMasterKey,
  deriveRecoveryAuthKey,
  encodeCrockford,
  fromBase64,
  generateKeypair,
  openDek,
  openProject,
  sealDek,
  sealPayload,
  sealProject,
  toBase64,
  unlockWithPassword,
  unlockWithRecovery,
} from "@/crypto";
import projectFixture from "@/crypto/__fixtures__/project-fixture.json";
import vaultFixture from "@/crypto/__fixtures__/vault-fixture.json";
import { PRIMITIVES_BACKEND } from "@/crypto/primitives";

// The self-test runs the SAME assertions as the Jest fixture tests, but against
// whatever primitive backend the platform resolved — on device that is the
// native backend (react-native-libsodium + the wharf-argon2 module + @noble),
// which CI cannot exercise. This screen is the M1 acceptance gate.

export type CheckStatus = "pending" | "running" | "pass" | "fail";

export interface CheckResult {
  readonly name: string;
  readonly status: CheckStatus;
  readonly detail?: string;
}

// Pinned known-answer vectors for the full derivation pipeline (argon2id p=4 +
// HKDF-SHA256). Identical to keys.test.ts; if the native argon2/HKDF path
// diverges by a single byte these fail.
const KAT_MASTER_KEY = "4whxiRmv/Go698JZxXM4WFdFVT68bs3LHUVkmL0+A8M=";
const KAT_AUTH_KEY = "nnzMcXPLofscNtfrXSFz0S7zt0yd1mkTzy0Gw7JWXH8=";
const KAT_RECOVERY_AUTH_KEY = "hmzd1iB3GK6Lw2OJlEG+D45nOZmKXthOiXHo4MqnzX0=";

const encoder = new TextEncoder();
const decoder = new TextDecoder();

function assert(condition: boolean, message: string): void {
  if (!condition) {
    throw new Error(message);
  }
}

function bytesEqual(a: Uint8Array, b: Uint8Array): boolean {
  if (a.length !== b.length) {
    return false;
  }
  for (let i = 0; i < a.length; i++) {
    if (a[i] !== b[i]) {
      return false;
    }
  }
  return true;
}

interface Check {
  readonly name: string;
  readonly run: () => Promise<void>;
}

// Fast argon2 cost for the create round-trip (the timing row and the KAT vectors
// exercise the real t=3/m=64MiB/p=4 params).
const FAST_PARAMS = { iterations: 1, memoryKiB: 8192, parallelism: 1 };

const CHECKS: readonly Check[] = [
  {
    name: "WHARFV vault unlock (password slot)",
    run: async () => {
      const blob = fromBase64(vaultFixture.vaultBase64);
      const unlocked = await unlockWithPassword(blob, vaultFixture.password);
      assert(decoder.decode(unlocked.payload) === vaultFixture.payloadUtf8, "payload mismatch");
    },
  },
  {
    name: "WHARFV vault unlock (recovery slot)",
    run: async () => {
      const blob = fromBase64(vaultFixture.vaultBase64);
      const unlocked = await unlockWithRecovery(blob, vaultFixture.recoveryCode);
      assert(decoder.decode(unlocked.payload) === vaultFixture.payloadUtf8, "payload mismatch");
    },
  },
  {
    name: "WHARFP unwrap sealed-box DEK",
    run: async () => {
      const opened = await openDek(
        fromBase64(projectFixture.wrappedDekBase64),
        fromBase64(projectFixture.publicKeyBase64),
        fromBase64(projectFixture.privateKeyBase64),
      );
      assert(bytesEqual(opened, fromBase64(projectFixture.dekBase64)), "DEK mismatch");
    },
  },
  {
    name: "WHARFP open project blob",
    run: async () => {
      const payload = await openProject(
        fromBase64(projectFixture.dekBase64),
        fromBase64(projectFixture.projectBlobBase64),
      );
      assert(decoder.decode(payload) === projectFixture.payloadUtf8, "payload mismatch");
    },
  },
  {
    name: "WHARFP seal + open round-trip",
    run: async () => {
      const dek = fromBase64(projectFixture.dekBase64);
      const payload = encoder.encode(projectFixture.payloadUtf8);
      const blob = await sealProject(dek, payload);
      const reopened = await openProject(dek, blob);
      assert(bytesEqual(reopened, payload), "round-trip mismatch");
    },
  },
  {
    name: "X25519 keypair seal + open round-trip",
    run: async () => {
      const { publicKey, privateKey } = await generateKeypair();
      const dek = encoder.encode("0123456789abcdef0123456789abcdef");
      const wrapped = await sealDek(dek, publicKey);
      const opened = await openDek(wrapped, publicKey, privateKey);
      assert(bytesEqual(opened, dek), "round-trip mismatch");
    },
  },
  {
    name: "Key derivation known-answer vectors (argon2id p=4 + HKDF)",
    run: async () => {
      const mk = await deriveMasterKey("hunter2", "  Deniz@ACME.io ");
      assert(toBase64(mk) === KAT_MASTER_KEY, "master key vector mismatch");
      assert((await deriveAuthKey(mk)) === KAT_AUTH_KEY, "auth key vector mismatch");
      const secret = Uint8Array.from({ length: 25 }, (_, i) => (i * 7 + 3) & 0xff);
      assert(
        (await deriveRecoveryAuthKey(secret)) === KAT_RECOVERY_AUTH_KEY,
        "recovery auth key vector mismatch",
      );
    },
  },
  {
    name: "Crockford recovery-code round-trip",
    run: async () => {
      const secret = Uint8Array.from({ length: 25 }, (_, i) => (i * 13 + 5) & 0xff);
      const decoded = decodeCrockford(encodeCrockford(secret));
      assert(bytesEqual(decoded, secret), "round-trip mismatch");
    },
  },
  {
    name: "WHARFV create + sealPayload re-seal",
    run: async () => {
      const original = encoder.encode('{"schema":1,"hosts":[]}');
      const created = await createVault("hunter2", original, FAST_PARAMS);
      const unlocked = await unlockWithPassword(created.blob, "hunter2");
      const updated = encoder.encode('{"schema":2,"hosts":[]}');
      const resealed = await sealPayload(unlocked, updated);
      const reopened = await unlockWithPassword(resealed, "hunter2");
      assert(bytesEqual(reopened.payload, updated), "re-seal payload mismatch");
    },
  },
];

export interface CryptoSelfTestState {
  readonly backend: string;
  readonly results: readonly CheckResult[];
  readonly running: boolean;
  readonly allPassed: boolean;
  readonly argon2Ms: number | null;
  readonly rerun: () => void;
}

// Times a full master-key derivation, i.e. argon2id at the real t=3/m=64MiB/p=4.
async function timeArgon2(): Promise<number> {
  const start = Date.now();
  await deriveMasterKey("timing-benchmark", "timing@wharf.dev");
  return Date.now() - start;
}

export function useCryptoSelfTestLogic(): CryptoSelfTestState {
  const [results, setResults] = useState<readonly CheckResult[]>(() =>
    CHECKS.map((c) => ({ name: c.name, status: "pending" as CheckStatus })),
  );
  const [running, setRunning] = useState(false);
  const [argon2Ms, setArgon2Ms] = useState<number | null>(null);
  // Each run bumps this; a stale async run (superseded by a rerun or unmount)
  // sees a changed id and stops writing state.
  const runIdRef = useRef(0);

  const run = useCallback(() => {
    const runId = runIdRef.current + 1;
    runIdRef.current = runId;
    const active = () => runIdRef.current === runId;

    setRunning(true);
    setArgon2Ms(null);
    setResults(CHECKS.map((c) => ({ name: c.name, status: "pending" as CheckStatus })));

    void (async () => {
      for (let i = 0; i < CHECKS.length; i++) {
        if (!active()) {
          return;
        }
        setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "running" } : r)));
        try {
          await CHECKS[i].run();
          if (!active()) {
            return;
          }
          setResults((prev) => prev.map((r, idx) => (idx === i ? { ...r, status: "pass" } : r)));
        } catch (err) {
          if (!active()) {
            return;
          }
          const detail = err instanceof Error ? err.message : String(err);
          setResults((prev) =>
            prev.map((r, idx) => (idx === i ? { ...r, status: "fail", detail } : r)),
          );
        }
      }

      try {
        const ms = await timeArgon2();
        if (active()) {
          setArgon2Ms(ms);
        }
      } catch {
        if (active()) {
          setArgon2Ms(null);
        }
      }
      if (active()) {
        setRunning(false);
      }
    })();
  }, []);

  useEffect(() => {
    run();
    return () => {
      // Invalidate any in-flight run on unmount.
      runIdRef.current += 1;
    };
  }, [run]);

  const allPassed = results.every((r) => r.status === "pass");

  return {
    backend: PRIMITIVES_BACKEND,
    results,
    running,
    allPassed,
    argon2Ms,
    rerun: run,
  };
}
