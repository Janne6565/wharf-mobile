import fixture from "./__fixtures__/vault-fixture.json";
import { fromBase64 } from "./base64";
import { unlockWithPassword, unlockWithRecovery } from "./wharfv";

// Byte-compatibility proof: this vault blob was produced by wharf-tui's Go
// `internal/vault` package (real DefaultParams: argon2id t=3, m=64MiB, p=4).
// If the TypeScript port unlocks it via BOTH slots and recovers the exact
// payload, the formats are byte-for-byte compatible: same header layout, same
// argon2id output at parallelism 4, same XChaCha20-Poly1305 sealing with the
// header as AAD, and the same Crockford recovery-code decoding.
//
// Under Jest this runs against the Node primitive backend (hash-wasm +
// libsodium-wrappers). The native backend runs the SAME assertions on hardware
// through the dev crypto self-test screen.
describe("byte-compat with wharf-tui Go vault", () => {
  const blob = fromBase64(fixture.vaultBase64);
  const expectedPayload = new TextEncoder().encode(fixture.payloadUtf8);

  it("unlocks a Go-created vault via the password slot", async () => {
    const unlocked = await unlockWithPassword(blob, fixture.password);
    expect(new TextDecoder().decode(unlocked.payload)).toBe(fixture.payloadUtf8);
    expect(unlocked.payload).toEqual(expectedPayload);
  }, 30_000);

  it("unlocks the same Go-created vault via the recovery slot", async () => {
    const unlocked = await unlockWithRecovery(blob, fixture.recoveryCode);
    expect(unlocked.payload).toEqual(expectedPayload);
  }, 30_000);
});
