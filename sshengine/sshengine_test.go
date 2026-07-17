package sshengine

import (
	"bytes"
	"crypto/ed25519"
	"crypto/rand"
	"io"
	"net"
	"os"
	"path/filepath"
	"strconv"
	"strings"
	"sync"
	"sync/atomic"
	"testing"
	"time"

	gliderssh "github.com/gliderlabs/ssh"
	"github.com/skeema/knownhosts"
	gossh "golang.org/x/crypto/ssh"
)

const (
	testPassword = "hunter2"
	testUser     = "tester"
	testKICode   = "123456"
)

// --- in-process sshd -------------------------------------------------------

type testServer struct {
	host string
	port int
}

func (ts *testServer) addr() string { return net.JoinHostPort(ts.host, strconv.Itoa(ts.port)) }

func newHostSigner(t *testing.T) gossh.Signer {
	t.Helper()
	_, priv, err := ed25519.GenerateKey(rand.Reader)
	if err != nil {
		t.Fatalf("generate host key: %v", err)
	}
	signer, err := gossh.NewSignerFromKey(priv)
	if err != nil {
		t.Fatalf("signer from key: %v", err)
	}
	return signer
}

// serve wires a gliderlabs server around cfg and returns its address. cfg is
// mutated to add a fresh host key and is started on a random loopback port.
func serve(t *testing.T, srv *gliderssh.Server) *testServer {
	t.Helper()
	srv.AddHostKey(newHostSigner(t))
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	go func() { _ = srv.Serve(ln) }()
	t.Cleanup(func() {
		_ = srv.Close()
		_ = ln.Close()
	})
	tcp := ln.Addr().(*net.TCPAddr)
	return &testServer{host: "127.0.0.1", port: tcp.Port}
}

// startPasswordServer authenticates by password (empty password rejects every
// attempt, for the auth-failure test).
func startPasswordServer(t *testing.T, password string, handler gliderssh.Handler) *testServer {
	return serve(t, &gliderssh.Server{
		Handler: handler,
		PasswordHandler: func(_ gliderssh.Context, pass string) bool {
			return password != "" && pass == password
		},
	})
}

// startKIServer authenticates only by keyboard-interactive, asking one question
// and accepting when the answer equals expected.
func startKIServer(t *testing.T, expected string, handler gliderssh.Handler) *testServer {
	return serve(t, &gliderssh.Server{
		Handler: handler,
		KeyboardInteractiveHandler: func(_ gliderssh.Context, ch gossh.KeyboardInteractiveChallenge) bool {
			ans, err := ch("", "", []string{"Verification code:"}, []bool{false})
			return err == nil && len(ans) == 1 && ans[0] == expected
		},
	})
}

// startSilentListener accepts TCP connections but never speaks SSH, so the
// client's handshake blocks until the connect deadline fires. Accepted conns
// are retained (and closed on cleanup) so their finalizers don't close them
// early.
func startSilentListener(t *testing.T) *testServer {
	t.Helper()
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	var mu sync.Mutex
	var conns []net.Conn
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			mu.Lock()
			conns = append(conns, c)
			mu.Unlock()
		}
	}()
	t.Cleanup(func() {
		_ = ln.Close()
		mu.Lock()
		for _, c := range conns {
			_ = c.Close()
		}
		mu.Unlock()
	})
	tcp := ln.Addr().(*net.TCPAddr)
	return &testServer{host: "127.0.0.1", port: tcp.Port}
}

// echoHandler copies stdin back to stdout and stays alive until the client
// closes stdin. It drains the window-change channel (gliderlabs' buffer is
// size 1 and pre-filled, so leaving it undrained stalls the request loop).
func echoHandler(s gliderssh.Session) {
	_, winCh, isPty := s.Pty()
	if isPty {
		go func() {
			for range winCh {
			}
		}()
	}
	_, _ = io.Copy(s, s)
}

// bannerHandler writes marker then keeps the session open (for pump/Snapshot).
func bannerHandler(marker string) gliderssh.Handler {
	return func(s gliderssh.Session) {
		_, winCh, isPty := s.Pty()
		if isPty {
			go func() {
				for range winCh {
				}
			}()
		}
		_, _ = io.WriteString(s, marker)
		_, _ = io.Copy(io.Discard, s)
	}
}

// windowHandler forwards every window change to winOut so a test can observe a
// resize reaching the server.
func windowHandler(winOut chan<- gliderssh.Window) gliderssh.Handler {
	return func(s gliderssh.Session) {
		_, winCh, isPty := s.Pty()
		if isPty {
			go func() {
				for w := range winCh {
					select {
					case winOut <- w:
					default:
					}
				}
			}()
		}
		_, _ = io.Copy(io.Discard, s)
	}
}

// --- fake Callbacks --------------------------------------------------------

type closeEv struct{ id, msg string }
type hostKeyEv struct{ promptID, sessionID, host, keyType, fp string }
type secretEv struct {
	promptID, sessionID, kind, prompt string
	echo                              bool
}

// fakeCB records callback traffic and resolves prompts via the engine. Prompt
// resolution runs synchronously inside the callback by default; a test wanting
// to defer a prompt (e.g. to cancel it) sets onSecret/onHostKey to a no-op.
type fakeCB struct {
	eng *Engine

	mu   sync.Mutex
	data map[string]*bytes.Buffer

	closedCh  chan closeEv
	hostKeyCh chan hostKeyEv
	secretCh  chan secretEv

	hostKeyCount atomic.Int32
	secretCount  atomic.Int32

	onHostKey func(*fakeCB, hostKeyEv)
	onSecret  func(*fakeCB, secretEv)
}

func newFakeCB() *fakeCB {
	return &fakeCB{
		data:      make(map[string]*bytes.Buffer),
		closedCh:  make(chan closeEv, 16),
		hostKeyCh: make(chan hostKeyEv, 16),
		secretCh:  make(chan secretEv, 16),
		onHostKey: func(f *fakeCB, ev hostKeyEv) { f.eng.ResolveHostKeyPrompt(ev.promptID, true) },
		onSecret:  func(f *fakeCB, ev secretEv) { f.eng.ResolveSecretPrompt(ev.promptID, []byte(testPassword)) },
	}
}

func (f *fakeCB) OnData(id string, data []byte) {
	f.mu.Lock()
	b := f.data[id]
	if b == nil {
		b = &bytes.Buffer{}
		f.data[id] = b
	}
	b.Write(data)
	f.mu.Unlock()
}

func (f *fakeCB) dataStr(id string) string {
	f.mu.Lock()
	defer f.mu.Unlock()
	if b := f.data[id]; b != nil {
		return b.String()
	}
	return ""
}

func (f *fakeCB) OnClosed(id, msg string) {
	select {
	case f.closedCh <- closeEv{id, msg}:
	default:
	}
}

func (f *fakeCB) OnHostKeyPrompt(promptID, sessionID, host, keyType, fp string) {
	f.hostKeyCount.Add(1)
	ev := hostKeyEv{promptID, sessionID, host, keyType, fp}
	select {
	case f.hostKeyCh <- ev:
	default:
	}
	if f.onHostKey != nil {
		f.onHostKey(f, ev)
	}
}

func (f *fakeCB) OnSecretPrompt(promptID, sessionID, kind, prompt string, echo bool) {
	f.secretCount.Add(1)
	ev := secretEv{promptID, sessionID, kind, prompt, echo}
	select {
	case f.secretCh <- ev:
	default:
	}
	if f.onSecret != nil {
		f.onSecret(f, ev)
	}
}

// --- helpers ---------------------------------------------------------------

func newEngine(t *testing.T, cb *fakeCB) *Engine {
	t.Helper()
	kh := filepath.Join(t.TempDir(), "known_hosts")
	eng := NewEngine(kh, cb)
	cb.eng = eng
	return eng
}

func newEngineAt(t *testing.T, cb *fakeCB, khPath string) *Engine {
	t.Helper()
	eng := NewEngine(khPath, cb)
	cb.eng = eng
	return eng
}

// connect dials ts with a 5s deadline and standard PTY size.
func connect(eng *Engine, id string, ts *testServer, storedPassword string) error {
	return eng.Connect(id, ts.host, ts.port, testUser, storedPassword, "xterm-256color", 80, 24, 5000)
}

func waitFor(t *testing.T, d time.Duration, what string, cond func() bool) {
	t.Helper()
	deadline := time.Now().Add(d)
	for time.Now().Before(deadline) {
		if cond() {
			return
		}
		time.Sleep(5 * time.Millisecond)
	}
	t.Fatalf("timeout waiting for: %s", what)
}

// --- tests -----------------------------------------------------------------

func TestConnectPasswordAuth(t *testing.T) {
	cb := newFakeCB()
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, echoHandler)

	if err := connect(eng, "s1", ts, ""); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { eng.Close("s1") })

	if cb.secretCount.Load() == 0 {
		t.Fatal("expected a password prompt")
	}
	ev := <-cb.secretCh
	if ev.kind != kindPassword {
		t.Fatalf("first prompt kind = %q, want %q", ev.kind, kindPassword)
	}
	if eng.get("s1") == nil {
		t.Fatal("session not registered after connect")
	}
}

func TestStoredPasswordSilentReplay(t *testing.T) {
	cb := newFakeCB()
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, echoHandler)

	if err := connect(eng, "s1", ts, testPassword); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { eng.Close("s1") })

	if n := cb.secretCount.Load(); n != 0 {
		t.Fatalf("stored password must not prompt, got %d prompts", n)
	}
}

func TestStoredPasswordRejectedThenPrompt(t *testing.T) {
	cb := newFakeCB() // default onSecret answers the correct testPassword
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, echoHandler)

	if err := connect(eng, "s1", ts, "wrong-stored"); err != nil {
		t.Fatalf("connect after prompt fallback: %v", err)
	}
	t.Cleanup(func() { eng.Close("s1") })

	if cb.secretCount.Load() == 0 {
		t.Fatal("expected a prompt after the stored password was rejected")
	}
	ev := <-cb.secretCh
	if ev.kind != kindPasswordRetry {
		t.Fatalf("prompt kind = %q, want %q", ev.kind, kindPasswordRetry)
	}
}

func TestKeyboardInteractiveRoundTrip(t *testing.T) {
	cb := newFakeCB()
	cb.onSecret = func(f *fakeCB, ev secretEv) {
		ans := testPassword
		if ev.kind == kindKeyboard {
			ans = testKICode
		}
		f.eng.ResolveSecretPrompt(ev.promptID, []byte(ans))
	}
	eng := newEngine(t, cb)
	ts := startKIServer(t, testKICode, echoHandler)

	if err := connect(eng, "s1", ts, ""); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { eng.Close("s1") })

	ev := <-cb.secretCh
	if ev.kind != kindKeyboard {
		t.Fatalf("prompt kind = %q, want %q", ev.kind, kindKeyboard)
	}
	if ev.prompt != "Verification code:" {
		t.Fatalf("prompt text = %q, want the server's question", ev.prompt)
	}
	if ev.echo {
		t.Fatal("expected echo=false for the KI question")
	}
}

func TestTOFUAcceptPersists(t *testing.T) {
	cb := newFakeCB()
	kh := filepath.Join(t.TempDir(), "known_hosts")
	eng := newEngineAt(t, cb, kh)
	ts := startPasswordServer(t, testPassword, echoHandler)

	if err := connect(eng, "s1", ts, testPassword); err != nil {
		t.Fatalf("first connect: %v", err)
	}
	t.Cleanup(func() { eng.Close("s1") })

	if cb.hostKeyCount.Load() != 1 {
		t.Fatalf("expected 1 host-key prompt, got %d", cb.hostKeyCount.Load())
	}
	ev := <-cb.hostKeyCh
	if !strings.HasPrefix(ev.fp, "SHA256:") {
		t.Fatalf("fingerprint %q lacks SHA256 prefix", ev.fp)
	}
	if _, err := knownhosts.New(kh); err != nil {
		t.Fatalf("known_hosts not parseable after accept: %v", err)
	}

	before := cb.hostKeyCount.Load()
	if err := connect(eng, "s2", ts, testPassword); err != nil {
		t.Fatalf("second connect: %v", err)
	}
	t.Cleanup(func() { eng.Close("s2") })
	if cb.hostKeyCount.Load() != before {
		t.Fatalf("second connect prompted again: before=%d after=%d", before, cb.hostKeyCount.Load())
	}
}

func TestTOFUDeclineFails(t *testing.T) {
	cb := newFakeCB()
	cb.onHostKey = func(f *fakeCB, ev hostKeyEv) { f.eng.ResolveHostKeyPrompt(ev.promptID, false) }
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, echoHandler)

	err := connect(eng, "s1", ts, testPassword)
	if err == nil {
		eng.Close("s1")
		t.Fatal("expected connect to fail on a declined host key")
	}
	if !strings.HasPrefix(err.Error(), codeHostKeyRejected+": ") {
		t.Fatalf("error = %q, want %s prefix", err.Error(), codeHostKeyRejected)
	}
}

func TestChangedHostKeyHardFails(t *testing.T) {
	cb := newFakeCB()
	kh := filepath.Join(t.TempDir(), "known_hosts")
	ts := startPasswordServer(t, testPassword, echoHandler)

	// Pre-seed a DIFFERENT key for this host:port.
	other := newHostSigner(t)
	line := knownhosts.Line([]string{knownhosts.Normalize(ts.addr())}, other.PublicKey())
	if err := os.WriteFile(kh, []byte(line+"\n"), 0600); err != nil {
		t.Fatalf("seed known_hosts: %v", err)
	}
	eng := newEngineAt(t, cb, kh)

	err := connect(eng, "s1", ts, testPassword)
	if err == nil {
		eng.Close("s1")
		t.Fatal("expected connect to fail on a changed host key")
	}
	if !strings.HasPrefix(err.Error(), codeHostKeyChanged+": ") {
		t.Fatalf("error = %q, want %s prefix", err.Error(), codeHostKeyChanged)
	}
	if cb.hostKeyCount.Load() != 0 {
		t.Fatalf("changed key must not prompt, got %d prompts", cb.hostKeyCount.Load())
	}
}

func TestWrongPasswordAuthFailed(t *testing.T) {
	cb := newFakeCB()
	cb.onSecret = func(f *fakeCB, ev secretEv) { f.eng.ResolveSecretPrompt(ev.promptID, []byte("nope")) }
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, echoHandler)

	err := connect(eng, "s1", ts, "")
	if err == nil {
		eng.Close("s1")
		t.Fatal("expected auth to fail with wrong password")
	}
	if !strings.HasPrefix(err.Error(), codeAuthFailed+": ") {
		t.Fatalf("error = %q, want %s prefix", err.Error(), codeAuthFailed)
	}
	if len(eng.list()) != 0 {
		t.Fatalf("failed connect left %d sessions", len(eng.list()))
	}
}

func TestDataPumpAndSnapshot(t *testing.T) {
	const marker = "pump-marker-xyz-42"
	cb := newFakeCB()
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, bannerHandler(marker))

	if err := connect(eng, "s1", ts, testPassword); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { eng.Close("s1") })

	waitFor(t, 5*time.Second, "OnData to deliver the marker", func() bool {
		return strings.Contains(cb.dataStr("s1"), marker)
	})
	waitFor(t, 5*time.Second, "Snapshot to contain the marker", func() bool {
		return strings.Contains(string(eng.Snapshot("s1")), marker)
	})
}

func TestWriteAndResize(t *testing.T) {
	cb := newFakeCB()
	eng := newEngine(t, cb)
	winCh := make(chan gliderssh.Window, 8)
	ts := startPasswordServer(t, testPassword, windowHandler(winCh))

	if err := connect(eng, "s1", ts, testPassword); err != nil {
		t.Fatalf("connect: %v", err)
	}
	t.Cleanup(func() { eng.Close("s1") })

	if err := eng.Write("s1", []byte("echo hi\n")); err != nil {
		t.Fatalf("write: %v", err)
	}
	if err := eng.Resize("s1", 120, 40); err != nil {
		t.Fatalf("resize: %v", err)
	}
	waitFor(t, 5*time.Second, "server to see the resize", func() bool {
		for {
			select {
			case w := <-winCh:
				if w.Width == 120 && w.Height == 40 {
					return true
				}
			default:
				return false
			}
		}
	})

	if err := eng.Write("missing", []byte("x")); err == nil {
		t.Fatal("write to unknown session should error")
	}
	if err := eng.Resize("missing", 10, 10); err == nil {
		t.Fatal("resize of unknown session should error")
	}
}

func TestCloseFiresOnClosedOnce(t *testing.T) {
	cb := newFakeCB()
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, echoHandler)

	if err := connect(eng, "s1", ts, testPassword); err != nil {
		t.Fatalf("connect: %v", err)
	}

	eng.Close("s1")
	eng.Close("s1") // idempotent

	select {
	case ev := <-cb.closedCh:
		if ev.id != "s1" {
			t.Fatalf("OnClosed id = %q, want s1", ev.id)
		}
		if ev.msg != "" {
			t.Fatalf("caller Close should report a clean end, got %q", ev.msg)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("no OnClosed delivered")
	}

	select {
	case ev := <-cb.closedCh:
		t.Fatalf("OnClosed fired more than once: %+v", ev)
	case <-time.After(200 * time.Millisecond):
	}

	if eng.get("s1") != nil {
		t.Fatal("closed session still registered")
	}
}

func TestCancelConnectDuringPrompt(t *testing.T) {
	cb := newFakeCB()
	cb.onSecret = nil // do not answer — leave the prompt pending
	eng := newEngine(t, cb)
	ts := startPasswordServer(t, testPassword, echoHandler)

	errCh := make(chan error, 1)
	go func() {
		errCh <- eng.Connect("s1", ts.host, ts.port, testUser, "", "xterm-256color", 80, 24, 5000)
	}()

	// Wait until the password prompt is outstanding, then cancel.
	select {
	case <-cb.secretCh:
	case <-time.After(5 * time.Second):
		t.Fatal("password prompt never fired")
	}
	eng.CancelConnect("s1")

	select {
	case err := <-errCh:
		if err == nil {
			t.Fatal("expected connect to fail after cancel")
		}
		if !strings.HasPrefix(err.Error(), codeCanceled+": ") {
			t.Fatalf("error = %q, want %s prefix", err.Error(), codeCanceled)
		}
	case <-time.After(5 * time.Second):
		t.Fatal("CancelConnect did not unblock the pending prompt")
	}
}

func TestConnectTimeout(t *testing.T) {
	cb := newFakeCB()
	eng := newEngine(t, cb)
	ts := startSilentListener(t)

	// 300ms deadline against a server that never completes the handshake.
	err := eng.Connect("s1", ts.host, ts.port, testUser, "", "xterm-256color", 80, 24, 300)
	if err == nil {
		eng.Close("s1")
		t.Fatal("expected a timeout error")
	}
	if !strings.HasPrefix(err.Error(), codeTimeout+": ") {
		t.Fatalf("error = %q, want %s prefix", err.Error(), codeTimeout)
	}
}
