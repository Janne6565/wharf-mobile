// Package sshengine is Wharf's mobile SSH engine: a gomobile-bindable facade
// over golang.org/x/crypto/ssh providing connection setup, TOFU host-key
// verification, password + keyboard-interactive auth, and live interactive
// shells whose output is mirrored to a native callback and recorded in a
// per-session ring buffer for reattach/replay.
//
// It is a deliberate port of the wharf-tui internal/sshx engine, reshaped to
// obey gomobile bind's restrictions: the exported surface uses only string,
// bool, int, []byte, error, and the Callbacks interface. There are no maps,
// struct slices, channels, or context.Context on any exported method — those
// would not survive the Go<->Swift/Kotlin bridge.
//
// # Threading contract (read before writing the native bridge)
//
// Every Callbacks method is invoked SYNCHRONOUSLY from an internal engine
// goroutine, never from the thread that called into the engine:
//
//   - OnData fires from the per-session output pump goroutine.
//   - OnClosed fires from the per-session waiter goroutine (exactly once per
//     established session).
//   - OnHostKeyPrompt / OnSecretPrompt fire from the goroutine running Connect
//     (i.e. the native background thread the app used to call Connect), from
//     inside the SSH handshake.
//
// The native implementation MUST NOT block inside a callback and MUST dispatch
// any real work (UI updates, disk writes, etc.) to its own thread/queue and
// return promptly. A slow OnData applies backpressure to the SSH channel; a
// panicking/erroring OnData is dropped and further remote output is only
// recorded in the ring (still retrievable via Snapshot), never redelivered.
//
// # Prompt resolution
//
// OnHostKeyPrompt and OnSecretPrompt hand out an engine-generated promptID and
// return immediately. The engine goroutine that raised the prompt blocks on a
// buffered(1) reply channel keyed by that promptID. The native side answers
// later — from any thread — via ResolveHostKeyPrompt / ResolveSecretPrompt.
// The reply channel is buffered so a Resolve* call never blocks even if the
// waiting goroutine has already given up (Connect timed out or was canceled).
// Resolving an unknown or already-consumed promptID is a silent no-op.
package sshengine

import (
	"context"
	"net"
	"strconv"
	"sync"
	"time"
)

// defaultTerm is used when the caller passes an empty termType. defaultCols /
// defaultRows back a caller that passes non-positive dimensions.
const (
	defaultTerm = "xterm-256color"
	defaultCols = 80
	defaultRows = 24
)

// Callbacks is the native-side listener. Implementations are provided by the
// Swift/Kotlin Expo module. See the package doc for the (load-bearing)
// threading contract: every method here runs on an engine goroutine and must
// return quickly without blocking.
type Callbacks interface {
	// OnData delivers merged remote stdout+stderr for a session. The []byte is
	// owned by the callee (a fresh copy per call).
	OnData(sessionID string, data []byte)
	// OnClosed fires exactly once per established session. errMsg is "" on a
	// clean end (clean remote exit or a caller-initiated Close); otherwise it
	// carries the failure reason (network drop, keepalive loss, non-zero exit).
	OnClosed(sessionID string, errMsg string)
	// OnHostKeyPrompt asks the user to trust an unknown host key (TOFU). Answer
	// with ResolveHostKeyPrompt(promptID, accept). A CHANGED key never prompts —
	// it fails Connect immediately with a host_key_changed error.
	OnHostKeyPrompt(promptID, sessionID, host, keyType, fingerprint string)
	// OnSecretPrompt asks the user for a secret. kind is one of:
	//   "password"       first password ask, no stored password was tried
	//   "password_retry" a previous password (stored or typed) was rejected
	//   "ki"             a keyboard-interactive question from the server
	// echo reports whether the server allows the input to be shown. Answer with
	// ResolveSecretPrompt(promptID, secret); pass nil to cancel authentication.
	OnSecretPrompt(promptID, sessionID, kind, prompt string, echo bool)
}

// Engine owns all live sessions, the known-hosts policy, and the pending
// prompt registry. Its methods are safe for concurrent use from native
// threads and from the engine's own goroutines.
type Engine struct {
	knownHostsPath string
	cb             Callbacks
	prompts        *promptRegistry

	mu       sync.Mutex
	sessions map[string]*sshSession
	pending  map[string]context.CancelFunc // in-flight Connects, for CancelConnect
}

// NewEngine creates an engine verifying host keys against knownHostsPath
// (created 0600 with a 0700 parent on first accepted key) and delivering
// events to cb.
func NewEngine(knownHostsPath string, cb Callbacks) *Engine {
	return &Engine{
		knownHostsPath: knownHostsPath,
		cb:             cb,
		prompts:        newPromptRegistry(),
		sessions:       make(map[string]*sshSession),
		pending:        make(map[string]context.CancelFunc),
	}
}

// Connect blocks until the interactive shell is established or the attempt
// fails, so the native side must call it on a background thread. sessionID is
// caller-supplied and must be unique per attempt; it keys every later call and
// every callback for this session.
//
// storedPassword "" means none. A non-empty stored password is replayed
// silently on the first attempt; if the server rejects it, prompting continues
// via OnSecretPrompt with kind "password_retry" (total 1 silent + 3 prompted,
// versus 3 prompted when nothing is stored).
//
// authMethod selects the auth chain. "key" enables the synced-vault-key
// public-key method (parsed from keysJSON) BEFORE the password + keyboard-
// interactive fallbacks. ANY other value — including "" from older callers —
// keeps today's password-first behavior with keys never offered; note this
// legacy default is password, unlike the TUI where "" means key mode. The
// password fallback is offered even in key mode (a deliberate deviation from
// the TUI): mobile has no agent or on-disk keys, so a key-mode host with no
// usable synced key must still be reachable via a password.
//
// keysJSON is a JSON array of synced private keys,
// [{"name":"id_ed25519","materialB64":"<base64 keyfile bytes>"}]; "" or "[]"
// means none. Entries that fail JSON or base64 decoding are skipped, never
// fatal. keysJSON is ignored unless authMethod is "key".
//
// timeoutMs bounds TCP dial + handshake + auth as a whole; <= 0 means no
// deadline (the attempt can still be aborted with CancelConnect). Once the
// shell is up the only watchdog is the 30s keepalive loop.
//
// A non-nil error's message is prefixed with a stable, parseable code:
// host_key_changed, host_key_rejected, auth_failed, canceled, timeout,
// network, or unknown, followed by ": " and detail.
func (e *Engine) Connect(sessionID, host string, port int, user, storedPassword, termType, authMethod, keysJSON string, cols, rows, timeoutMs int) error {
	if port == 0 {
		port = 22
	}
	if termType == "" {
		termType = defaultTerm
	}
	if cols <= 0 {
		cols = defaultCols
	}
	if rows <= 0 {
		rows = defaultRows
	}
	addr := net.JoinHostPort(host, strconv.Itoa(port))

	var (
		ctx    context.Context
		cancel context.CancelFunc
	)
	if timeoutMs > 0 {
		ctx, cancel = context.WithTimeout(context.Background(), time.Duration(timeoutMs)*time.Millisecond)
	} else {
		ctx, cancel = context.WithCancel(context.Background())
	}
	defer cancel()

	// Publish the cancel func so CancelConnect(sessionID) can abort this attempt
	// (aborting a pending prompt, the dial, or the handshake).
	e.mu.Lock()
	e.pending[sessionID] = cancel
	e.mu.Unlock()
	defer func() {
		e.mu.Lock()
		delete(e.pending, sessionID)
		e.mu.Unlock()
	}()

	keys := parseVaultKeys(keysJSON)
	_, err := e.dial(ctx, sessionID, host, addr, user, storedPassword, termType, authMethod, keys, cols, rows)
	if err != nil {
		return connectError(err, ctx.Err())
	}
	return nil
}

// CancelConnect aborts a Connect still in progress for sessionID (cancels its
// context, unblocking a pending host-key/secret prompt, dial, or handshake).
// It is a no-op once the shell is established or if there is no such attempt.
func (e *Engine) CancelConnect(sessionID string) {
	e.mu.Lock()
	cancel := e.pending[sessionID]
	e.mu.Unlock()
	if cancel != nil {
		cancel()
	}
}

// Write forwards keystrokes to the session's remote stdin. It errors if the
// session is unknown or already closed.
func (e *Engine) Write(sessionID string, data []byte) error {
	s := e.get(sessionID)
	if s == nil {
		return errUnknownSession
	}
	return s.write(data)
}

// Resize updates the remote PTY window to cols x rows. It errors if the
// session is unknown or already closed.
func (e *Engine) Resize(sessionID string, cols, rows int) error {
	s := e.get(sessionID)
	if s == nil {
		return errUnknownSession
	}
	return s.resize(cols, rows)
}

// Snapshot returns a copy of the session's ring buffer (most recent output, up
// to 256 KiB) in write order, for replay after reattaching. It returns nil for
// an unknown session.
func (e *Engine) Snapshot(sessionID string) []byte {
	s := e.get(sessionID)
	if s == nil {
		return nil
	}
	return s.ring.Snapshot()
}

// Close terminates a session. It is idempotent and safe from any thread; the
// resulting OnClosed reports a clean end ("").
func (e *Engine) Close(sessionID string) {
	s := e.get(sessionID)
	if s != nil {
		s.userClose()
	}
}

// CloseAll terminates every live session.
func (e *Engine) CloseAll() {
	for _, s := range e.list() {
		s.userClose()
	}
}

// ResolveHostKeyPrompt answers an OnHostKeyPrompt. accept=true trusts and
// persists the key; false aborts the connection. Unknown/expired promptIDs are
// silently ignored.
func (e *Engine) ResolveHostKeyPrompt(promptID string, accept bool) {
	e.prompts.resolveHostKey(promptID, accept)
}

// ResolveSecretPrompt answers an OnSecretPrompt with secret; nil means the user
// cancelled authentication. Unknown/expired promptIDs are silently ignored.
func (e *Engine) ResolveSecretPrompt(promptID string, secret []byte) {
	e.prompts.resolveSecret(promptID, secret)
}

// register inserts s (last writer wins for a reused sessionID).
func (e *Engine) register(s *sshSession) {
	e.mu.Lock()
	e.sessions[s.id] = s
	e.mu.Unlock()
}

// remove drops the mapping for id only if it still points at s, so a fresh
// re-dial that reused the ID isn't evicted by the old session's teardown.
func (e *Engine) remove(id string, s *sshSession) {
	e.mu.Lock()
	if e.sessions[id] == s {
		delete(e.sessions, id)
	}
	e.mu.Unlock()
}

func (e *Engine) get(id string) *sshSession {
	e.mu.Lock()
	defer e.mu.Unlock()
	return e.sessions[id]
}

func (e *Engine) list() []*sshSession {
	e.mu.Lock()
	defer e.mu.Unlock()
	out := make([]*sshSession, 0, len(e.sessions))
	for _, s := range e.sessions {
		out = append(out, s)
	}
	return out
}
