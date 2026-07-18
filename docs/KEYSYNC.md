# Vault-synced SSH keys (M8) — design

Goal: opt-in sync of SSH **private keys** through the personal encrypted vault, so
mobile (and any secondary desktop) can authenticate with keys instead of falling
back to passwords. Supersedes PLAN.md decision 5 ("no key mode on mobile").

Status: **planned** (design agreed 2026-07-19; not started).

## Model

Today the vault stores only `keyPath` — a filesystem path on the machine that owns
the key; the key material never leaves that machine. This design extends the
established "secrets live in the E2E-encrypted vault" principle (stored host
passwords already work this way) to SSH keys, **opt-in per key**:

- The personal vault document (WHARFV payload) gains a top-level `keys` array —
  **schema 3**:

  ```jsonc
  {
    "schema": 3,
    "hosts": [ ... ],
    "identity": { ... },
    "keys": [
      {
        "id": "16-hex",              // like host ids (store.newID)
        "name": "id_ed25519",        // display name, unique case-insensitive
        "type": "ed25519",           // ssh key type, for the UI badge
        "material": "base64",        // the keyfile bytes VERBATIM (OpenSSH/PEM armor)
        "publicKey": "ssh-ed25519 AAAA... comment",  // authorized_keys line
        "sourcePath": "~/.ssh/id_ed25519",           // origin path, display only
        "addedAt": "RFC3339"
      }
    ]
  }
  ```

- **Keyfile bytes are stored verbatim.** A passphrase-protected keyfile stays
  passphrase-protected inside the vault; clients prompt for the passphrase at
  connect time (`ParsePrivateKeyWithPassphrase`), exactly like the TUI's existing
  keyfile flow. We never store a decrypted copy. Fingerprints are derived at
  render, not stored.
- **Personal vault only.** Keys are never written into a project (WHARFP) blob —
  "private keys are never shared" holds. Connecting to a *project* host uses the
  caller's own personal synced keys.
- **Auth resolution order** (key-mode hosts, v1 — no per-host key binding yet):
  local `keyPath` file / agent where they exist (TUI), then **all synced vault
  keys in stable order**, then the password prompt fallback. Servers with strict
  `MaxAuthTries` are the known caveat (the TUI already documents it); if a user
  accumulates many synced keys, per-host binding (`host.keyId`) is the planned
  v2 refinement.

## Compatibility — why schema 3 is a hard bump

Go's `internal/store` marshals a **typed** document: any field an old build does
not know is silently dropped on the next save. An old TUI opening a keys-bearing
vault would therefore destroy the synced keys. Same reasoning as the schema-2
(identity) bump, same remedy: `schemaVersion = 3`, `Open` accepts 1–3, and older
builds hard-error on 3 ("update wharf"). Updated TUIs write 3 unconditionally
(v2 precedent: hard cut, all of a user's TUI installs must update together).

Mobile (`vault/mutate.ts`) and web (`vault/identity.ts`) already mutate the RAW
parsed JSON and re-seal payload bytes without a typed round-trip, so both preserve
`keys` untouched — audit, no rework expected. The backend never sees plaintext;
**no backend change** (a key entry is ~0.5 KB against the 1.4 MB blob cap).

## Threat-model delta (document, don't hide)

Synced keys exist as ciphertext on the server under the same guarantees as stored
host passwords: argon2id master key, XChaCha20-Poly1305 vault, no server-side
recovery. Compromise of the master password or recovery code now also yields the
synced SSH keys; on mobile, the biometric-gated cached DEK guards them like
everything else. Keys the user never opts in (and YubiKey-resident keys, which
physically cannot sync) stay machine-local. Note this in the wharf-backend README
threat-model section when shipping.

## Workstreams

**W1 — wharf-tui (foundation; standalone value: second desktops get keys)**
1. `internal/store`: schema 3; `Keys []VaultKey`; Add/Remove with name
   uniqueness; document struct + fingerprint tests.
2. Keys tab: badge local vs synced; actions — sync-to-vault (reads the file,
   file stays), remove-from-vault; the generate flow gains an "also sync" toggle.
3. `internal/sshx`: in key mode, append signers parsed from vault key material
   (passphrase prompt path already exists) after keyPath/agent signers.

**W2 — mobile engine (`sshengine/` + `modules/wharf-ssh`)**
4. Engine `Connect` gains key material (gomobile-flat: a JSON string of
   `{id, materialB64}` entries); key mode = publicKeys chain then the existing
   password prompt fallback; new secret-prompt kind `passphrase` (carries the key
   name for the modal label). Port the TUI's signer/passphrase logic.
5. Rebuild + commit the iOS xcframework (`scripts/build-ssh-engine.sh`); Swift +
   TS bridge pass-through. (Kotlin/aar stays NDK-gated as today.)

**W3 — mobile app**
6. Vault layer: typed key **metadata** for the UI (id/name/type/fingerprint —
   private material is stripped exactly like host passwords); a transient
   `keySecret`-style read of the material from the session payload at connect
   time only. Never in Redux.
7. Terminal flow: key-mode hosts (personal and project) resolve synced keys and
   hand them to the engine; passphrase prompt in `SecretPromptModal` (no
   "remember" for passphrases in v1); password fallback unchanged.
8. Keys tab: real list — synced keys with type badge + fingerprint + copy-public-
   key, above the existing identity card; refreshed empty-state/footnote copy.
   No keygen and no key deletion on mobile in v1 (view + use only).

**W4 — parity + docs**
9. Extend the Go-generated byte-compat fixture with a schema-3 keys payload;
   mobile + web fixture tests assert identical parsing (project-fixture.json
   precedent).
10. wharf-backend README threat-model note; PLAN.md decision update; KB update.

Suggested order: W1 → W2 → W3 → W4. W1 ships alone (TUI-to-TUI key sync);
mobile key auth lands only after the engine rebuild.

## Open items (decide before/while building)

- Per-host key binding (`host.keyId`) — deferred to v2; revisit if MaxAuthTries
  bites.
- Passphrase caching per unlocked session (avoid re-prompting every connect) —
  nice-to-have, not v1.
- Mobile keygen (device-local key, Keychain/Keystore) — orthogonal feature,
  explicitly out of scope here.
