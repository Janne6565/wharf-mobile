# wharf-mobile — Implementation Plan (v1)

> Drafted 2026-07-16. Move into the wharf-mobile repo once created.

Greenfield React Native + Expo companion app for Wharf. Repo: `github.com/Janne6565/wharf-mobile`, local at `~/projects/wharf/wharf-mobile`. Mobile is a **DIRECT-token client like the TUI**, a **well-behaved Projects participant** per the approved projects plan, and reuses the wharf-web TS crypto layer with a swapped primitives implementation proven by the same Go-generated fixtures.

---

## A. Design-mock extraction and v1 scope

Source of truth: `~/projects/wharf/design/Wharf Mobile.dc.html`. Four screens (iOS frames, dark `#0A0E13`, JetBrains Mono, accent `#57D7C2` + theme options `#6FB3E8 / #C983E8 / #FFC86B`):

**01 · Sign in** — brand `⋻ wharf`, tagline "your fleet, one pocket". Buttons: Continue with Google / GitHub / email. Footer: "Your vault is end-to-end encrypted. Private keys never leave your devices." (Decorative logo cursor dropped per the established cursor decision.)

**02 · Hosts** — title + circular `+` add button; search field; hosts **grouped into sections by project** (`ATLAS PLATFORM`, `PERSONAL`); rows: status dot (green reachable / gray unknown), mono name, `user@host:port`, chevron. **4-tab bar**: `❯_ Hosts`, `▯ Projects`, `⬡ Keys`, `◎ Settings`.

**03 · Terminal** — full interactive SSH session (header, scrollback, prompt, key accessory row `esc ⇥ ctrl alt / ~ ↑ ↓`). **Deferred to post-v1** (see below).

**04 · Project detail** — `‹ Projects` back (implies a list screen), title + "Core API + data plane · 4 hosts", **MEMBERS card** (initial avatars, name + `(you)`, role right-aligned, final `+ Invite member` accent row), pending invite line (`○ sam@acme.io · invited · awaiting accept`), **HOSTS card** (dot + name + chevron).

**Confirmed absent** (removal decision holds): no shared sessions, no chat, no presence.

**Implied but not mocked** (design minimally from web/TUI precedent): projects list, invite sheet, incoming-invite accept/decline, unlock screen, pairing-code entry, host detail, host forms, Keys tab, Settings tab, conflict sheet.

### Terminal — deferred to post-v1 (M7)

1. No acceptable RN SSH library: wrappers like `react-native-ssh-sftp` are unmaintained, pre-New-Architecture (Expo SDK 55+ is New-Architecture-only), no interactive PTY story.
2. A server-side WebSocket SSH bridge is **forbidden by the zero-knowledge model** (server would see plaintext + keys).
3. The credible path — a gomobile-compiled Go SSH engine (reusing wharf-tui `internal/sshx` design) via an Expo Module + SwiftTerm / Termux terminal-view (or xterm.js WebView) — is its own project-sized milestone.

v1 keeps the mock's IA intact (host rows → host detail screen) so the terminal slots in later without restructure.

### v1 scope

| In v1 (mock-driven) | Deferred |
|---|---|
| Sign-in (email login + browser pairing-code for OAuth accounts) | Native in-app OAuth (needs backend deep-link redirect) |
| Hosts grouped by project, search, status dots, host detail, add/edit host | Advanced reachability probing |
| Personal vault sync (optimistic versioning, conflict sheet, offline cache) | — |
| Projects list + detail (members, roles, `(you)`, pending invites), project hosts | Rotation / removal / role change / delete (web+TUI-only) |
| Accept/decline invites; `+ Invite member`; background finalize-keys pass | — |
| Keys tab read-only; Settings (theme, biometrics, account, sign out) | Key generation / YubiKey |
| — | **SSH terminal → M7** |

**Admin scope:** mobile v1 is **member-plus** — accepts invites, creates/revokes invites, runs the finalize-keys pass during sync (cheap, improves invite latency when the phone is the only online admin device). NOT a rotation surface (most conflict-sensitive flow, not in the mock, every admin has a desktop surface).

---

## B. Auth + vault model

- **Email login**: full client-side derivation on device (`deriveMasterKey` argon2id → `deriveAuthKey` → `POST /auth/login {tokenMode: DIRECT}`).
- **Google/GitHub**: system browser → web sign-in → web pairing screen → app pairing-code entry → `POST /device-codes/exchange` (zero backend changes; only path for OAuth-only accounts anyway). Future: `wharf://oauth` deep-link redirect (backend work, deferred).
- Tokens: Bearer + 401→refresh-retry interceptor (TUI port); refresh token in SecureStore.
- **Vault blob → file** (`expo-file-system` document dir; SecureStore has a ~2 KB/value ceiling, blobs up to 1 MiB; blob is ciphertext by design). **Small secrets → SecureStore**: refresh token, sync-metadata key, opt-in cached DEK.
- **Unlock: biometric-gated cached DEK** (recommended): first unlock via master password (argon2id native, ~0.5–1.5 s on modern phones), then offer Face ID/fingerprint storing the **DEK** (never the password) in a `requireAuthentication: true` SecureStore entry. Sound because password change / recovery reset / `sealPayload` all preserve the DEK; fallback to password prompt if a pulled blob fails under the cached DEK. Master password in memory only while unlocked (needed for adopt-remote), zeroed on lock/background.
- **Sync engine** (`src/sync/engine.ts`): TS port of the TUI's per-blob optimistic-versioning state machine (fast-forward pull/push, 409 re-pass, keep-local/take-remote sheet). Pass order: personal blob → identity publish (409 → pull+retry) → project blobs (stateless wrappedDek unwrap; vanished = removed) → invites → finalize. Sync state in a JSON file sealed under an HKDF subkey of the DEK (mirrors `session.enc`). Triggered on foreground + debounced after mutations.

---

## C. Stack

| Concern | Choice |
|---|---|
| Runtime | Expo current SDK (57 at scaffold; RN 0.86, New Architecture), **CNG/prebuild + expo-dev-client** (native crypto rules out Expo Go) |
| Language/tooling | TypeScript strict, Bun, Biome |
| Navigation | expo-router, `(tabs)` layout = the 4-tab bar |
| State | Redux Toolkit (session/vault/settings) + TanStack Query (per REACT.md) |
| API | Orval against a **committed copy** of `openapi.json` (`bun gen:api` syncs from `../wharf-backend`), axios `customInstance` |
| Crypto | **react-native-libsodium** (Serenity Kit, JSI, libsodium-wrappers-compatible API) + **native argon2** (react-native-argon2; fallback: tiny in-repo Expo Module `modules/wharf-argon2` over argon2kt/Argon2Swift) + **@noble/hashes** (SHA-256/HKDF) |
| Styling | NativeWind v4 with the mock's tokens; JetBrains Mono; lucide-react-native |
| i18n | react-i18next, typed `resources.ts` + module augmentation, en+de |
| Forms | react-hook-form + Zod |
| Testing | jest-expo + RN Testing Library; crypto fixtures under Jest via a **Node primitives implementation**; **on-device crypto self-test screen** (dev builds) for the native primitives |

**Crypto facts (verified):** hash-wasm can't run on today's Hermes (no WASM; Hermes v1 WASM is too bleeding-edge to bet the unlock path on). libsodium-wrappers (WASM) likewise out → react-native-libsodium JSI matches its API except argon2-with-parallelism → dedicated native argon2 module (t=3/m=64MiB/p=4). Everything above `primitives.ts` ports **verbatim** from wharf-web (`wharfv.ts`, `wharfp.ts`, `x25519.ts`, `keys.ts`, `crockford.ts`, `base64.ts`, `errors.ts`, `payload.ts`):

```
src/crypto/primitives/
  types.ts            # contract
  index.native.ts     # react-native-libsodium + native argon2 + @noble/hashes
  index.node.ts       # hash-wasm + libsodium-wrappers (Jest/CI only)
```

**Fixture discipline:** copy `vault-fixture.json` + `project-fixture.json` byte-identically from wharf-web; port both fixture tests; run in CI (Node primitives) AND on-device via the self-test screen (native primitives — the part CI can't prove). Never regenerate unilaterally.

### Folder layout (house component/hook split)

```
app/  _layout.tsx  sign-in.tsx  pair.tsx  unlock.tsx  dev/crypto-selftest.tsx
      (tabs)/_layout.tsx
      (tabs)/hosts/{index,[hostId],edit}.tsx
      (tabs)/projects/{index,[projectId]}.tsx
      (tabs)/keys/index.tsx  (tabs)/settings/index.tsx
src/  api/ crypto/ vault/ sync/ store/ features/ components/ i18n/ lib/
modules/wharf-argon2/        # only if the fallback module is needed
openapi.json  orval.config.ts  biome.json  jest.config.js  app.config.ts  eas.json
```

Vault document types accept schema 1 AND 2 (`identity`); identity bootstrap writes schema 2 via `sealPayload` lazily on first Projects use.

---

## D. Repo, CI, delivery

- `gh repo create Janne6565/wharf-mobile` → `~/projects/wharf/wharf-mobile`; sync-conventions (`react auth tools`) + CLAUDE.md wiring.
- CI (PR + main): `bun install` → `tsc --noEmit` → `biome ci` → `bun run test`. No Docker/cluster deployment (client app).
- Builds: EAS Build for dev-client + release binaries; local `expo run:ios/android` day-to-day. Native builds not in PR CI; optional manual/tagged EAS workflow.
- API base: `EXPO_PUBLIC_API_BASE`, default `https://wharf.jannekeipert.de/api`.

---

## E. Milestones

- **M0 Scaffold + shell** — repo, Expo app, tab shell styled to the mock, typed i18n, providers, Orval, CI green. *Verify:* boots on iOS sim + Android emu; first PR green.
- **M1 Crypto core (de-risking spike)** — port crypto, native primitives, both fixtures, self-test screen, argon2 timing. *Verify:* Jest green; self-test all-PASS on physical iOS + Android; argon2 < ~2 s.
- **M2 Auth + vault read** — sign-in per mock, pairing exchange, token refresh, password unlock → biometric DEK cache, Hosts read-only, lock-on-background. *Verify:* pair against live backend; TUI-created hosts appear; Face ID reopen works.
- **M3 Sync + host CRUD** — engine, conflict sheet, offline cache, host forms, debounced push. *Verify:* two-device drill both directions; airplane-mode read.
- **M4 Projects (member level)** — identity bootstrap, projects list/detail per mock, DEK unwrap + WHARFP open, project hosts grouped in Hosts tab, accept/decline, awaiting-access state. *Verify:* invite from web → accept on phone → hosts appear after finalize.
- **M5 Invite + finalize (light admin)** — invite sheet, revoke, background finalize pass. *Verify:* phone as the admin surface end-to-end; rotation endpoints unused.
- **M6 Polish + release** — Settings, Keys screen, empty/loading/error branches, i18n parity, EAS release. *Verify:* full manual pass vs mock; installs on both platforms.
- **M7 (post-v1) Terminal** — gomobile SSH engine + SwiftTerm/Termux-view emulation; separate plan.

---

## F. Decisions (resolved 2026-07-16)

1. Repo visibility: **public** (`Janne6565/wharf-mobile`).
2. Distribution: **TestFlight + Play internal** — user has both Apple Developer and Google Play accounts; EAS submit config lands in M6.
3. Terminal deferred to post-v1 M7: **confirmed**.
4. Unlock posture: **biometric-gated cached DEK** with password fallback.
5. Admin scope v1: **member-plus** (invites + finalize-keys; no rotation/removal/role-change): **confirmed**.
