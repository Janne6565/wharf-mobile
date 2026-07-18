package sshengine

import (
	"context"
	"encoding/base64"
	"encoding/json"
	"errors"
	"strings"

	"golang.org/x/crypto/ssh"
)

// Prompt kinds surfaced through Callbacks.OnSecretPrompt.
const (
	kindPassword      = "password"       // first password ask, nothing tried yet
	kindPasswordRetry = "password_retry" // a prior password (stored or typed) was rejected
	kindKeyboard      = "ki"             // a keyboard-interactive question
	kindPassphrase    = "passphrase"     // the passphrase for an encrypted synced vault key; prompt text is the key name
)

// authModeKey is the Connect authMethod value that enables the synced-vault-key
// chain. ANY other value — including "" from older callers — keeps the
// password-first behavior. This is deliberately unlike the TUI, where "" means
// key mode: mobile's legacy default is password (there were no synced keys on
// mobile before this).
const authModeKey = "key"

// vaultKey is one decoded synced private key: its display name plus the
// verbatim keyfile bytes (OpenSSH/PEM armor) taken from the personal vault. A
// passphrase-protected key stays protected here; the signer source prompts for
// the passphrase only when the key is actually offered.
type vaultKey struct {
	name     string
	material []byte
}

// parseVaultKeys decodes the keysJSON Connect argument: a JSON array of
// {"name","materialB64"} entries. "" or "[]" yields no keys. Decoding is
// skip-not-fail — malformed JSON yields no keys, and any single entry whose
// base64 material does not decode is dropped — so a bad payload can never turn
// a connect into an error before auth even begins.
func parseVaultKeys(keysJSON string) []vaultKey {
	trimmed := strings.TrimSpace(keysJSON)
	if trimmed == "" {
		return nil
	}
	var raw []struct {
		Name        string `json:"name"`
		MaterialB64 string `json:"materialB64"`
	}
	if err := json.Unmarshal([]byte(trimmed), &raw); err != nil {
		return nil // malformed JSON: no keys, never fatal
	}
	var keys []vaultKey
	for _, r := range raw {
		material, err := base64.StdEncoding.DecodeString(r.MaterialB64)
		if err != nil {
			continue // bad base64 entry: skip it, keep the rest
		}
		keys = append(keys, vaultKey{name: r.Name, material: material})
	}
	return keys
}

// authMethods assembles the auth chain for a connect. It has two shapes,
// selected by authMethod:
//
//	key mode (authMethod == "key"): synced-vault-key public-key method →
//	    password (stored replay + prompt) → keyboard-interactive.
//	password mode ("", "password", anything else): password → keyboard-
//	    interactive; keys are NEVER offered.
//
// The password fallback in key mode is a DELIBERATE DEVIATION from the TUI,
// whose key mode never offers a password. The TUI can fall back on an agent or
// on-disk key files; mobile has neither, so a key-mode host whose synced keys
// are all unusable (none synced yet, all wrong-passphrase, strict server) would
// otherwise be unconnectable. Offering the password keeps it reachable.
// keyboard-interactive is offered in both modes for 2FA / PAM and only fires
// when the server actually offers that method.
func (e *Engine) authMethods(ctx context.Context, sessionID, user, host, storedPassword, authMethod string, keys []vaultKey) []ssh.AuthMethod {
	var methods []ssh.AuthMethod

	if authMethod == authModeKey {
		// Vault-key public-key method first; it lazily parses each key only when
		// the server actually tries public-key auth.
		methods = append(methods, ssh.PublicKeysCallback(e.vaultKeySigners(ctx, sessionID, keys)))
		// Password fallback — see the function doc for why key mode still offers
		// it on mobile (no agent, no key files).
		methods = append(methods, e.passwordMethod(ctx, sessionID, user, host, storedPassword))
	} else {
		// Password mode: a stored/prompted password only, never a public key.
		methods = append(methods, e.passwordMethod(ctx, sessionID, user, host, storedPassword))
	}

	methods = append(methods, ssh.KeyboardInteractive(func(name, instruction string, questions []string, echos []bool) ([]string, error) {
		answers := make([]string, len(questions))
		for i, q := range questions {
			secret, err := e.askSecret(ctx, sessionID, kindKeyboard, q, echos[i])
			if err != nil {
				return nil, err
			}
			answers[i] = string(secret)
		}
		return answers, nil
	}))

	return methods
}

// vaultKeySigners returns a lazy signer source for the synced vault keys,
// parsed only when the public-key method is actually attempted. Each key is
// tried in order; an encrypted key prompts for its passphrase via
// OnSecretPrompt with kind "passphrase" (prompt text = the key name).
//
// Port of the TUI's vaultKeySigners with the same skip-not-abort semantics: one
// bad key must not abort the whole chain, so a canceled passphrase, a wrong
// passphrase, or any parse error SKIPS that key and continues with the rest.
// The collected signers may be empty, in which case the public-key method
// offers nothing and the chain falls through to the password / keyboard-
// interactive fallbacks.
func (e *Engine) vaultKeySigners(ctx context.Context, sessionID string, keys []vaultKey) func() ([]ssh.Signer, error) {
	return func() ([]ssh.Signer, error) {
		var signers []ssh.Signer
		for _, k := range keys {
			signer, err := ssh.ParsePrivateKey(k.material)
			if err == nil {
				signers = append(signers, signer)
				continue
			}
			var missing *ssh.PassphraseMissingError
			if !errors.As(err, &missing) {
				// Corrupt / unsupported key material: skip it, keep going.
				continue
			}
			pass, perr := e.askSecret(ctx, sessionID, kindPassphrase, k.name, false)
			if perr != nil {
				// Canceled prompt (ErrCanceled) or ctx done: skip this key rather
				// than abort — another synced key may still authenticate.
				continue
			}
			signer, err = ssh.ParsePrivateKeyWithPassphrase(k.material, pass)
			if err != nil {
				// Wrong passphrase or other parse failure: skip this key.
				continue
			}
			signers = append(signers, signer)
		}
		return signers, nil
	}
}

// passwordMethod builds the retryable password method. A non-empty
// storedPassword is replayed on the first attempt without prompting; if the
// server rejects it later attempts prompt (4 total: 1 stored + 3 prompts,
// versus 3 prompts when nothing is stored). The first prompt with no prior
// rejection is kind "password"; every prompt following a rejected attempt
// (stored or typed) is kind "password_retry".
func (e *Engine) passwordMethod(ctx context.Context, sessionID, user, host, storedPassword string) ssh.AuthMethod {
	hasStored := storedPassword != ""
	maxAttempts := 3
	if hasStored {
		maxAttempts = 4 // 1 silent replay of the stored password + 3 prompts
	}

	attempt := 0
	cb := ssh.PasswordCallback(func() (string, error) {
		n := attempt
		attempt++
		if hasStored && n == 0 {
			return storedPassword, nil // silent replay
		}
		// RetryableAuthMethod only re-invokes this after the previous password
		// was rejected, so any attempt past the first (or past the stored one)
		// is a retry.
		kind := kindPassword
		prompt := user + "@" + host
		if n > 0 {
			kind = kindPasswordRetry
			prompt = "previous password was rejected"
		}
		secret, err := e.askSecret(ctx, sessionID, kind, prompt, false)
		if err != nil {
			return "", err
		}
		return string(secret), nil
	})
	return ssh.RetryableAuthMethod(cb, maxAttempts)
}
