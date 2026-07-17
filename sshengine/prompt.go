package sshengine

import (
	"context"
	"strconv"
	"sync"
	"sync/atomic"
)

// promptSeq backs unique promptIDs. A monotonic counter is enough: IDs only
// need to be unique among concurrently-outstanding prompts and opaque to the
// native side.
var promptSeq atomic.Uint64

func nextPromptID() string { return "p" + strconv.FormatUint(promptSeq.Add(1), 10) }

// promptRegistry maps engine-generated promptIDs to the buffered(1) reply
// channels the asking goroutine waits on. Resolve* calls (from any native
// thread) look up the channel and send; the entry is removed on resolve and on
// the asking goroutine giving up, so a late/duplicate Resolve is a silent no-op.
type promptRegistry struct {
	mu      sync.Mutex
	hostKey map[string]chan bool
	secret  map[string]chan []byte
}

func newPromptRegistry() *promptRegistry {
	return &promptRegistry{
		hostKey: make(map[string]chan bool),
		secret:  make(map[string]chan []byte),
	}
}

// askHostKey raises a TOFU prompt and blocks until the native side answers or
// ctx is cancelled. A nil Callbacks is treated as a cancel so auth can never
// deadlock waiting for an answer that will never arrive.
func (e *Engine) askHostKey(ctx context.Context, sessionID, host, keyType, fingerprint string) (bool, error) {
	if e.cb == nil {
		return false, ErrCanceled
	}
	// Buffered so a Resolve* never blocks even after we stop selecting (ctx done).
	reply := make(chan bool, 1)
	id := nextPromptID()
	e.prompts.mu.Lock()
	e.prompts.hostKey[id] = reply
	e.prompts.mu.Unlock()
	defer func() {
		e.prompts.mu.Lock()
		delete(e.prompts.hostKey, id)
		e.prompts.mu.Unlock()
	}()

	e.cb.OnHostKeyPrompt(id, sessionID, host, keyType, fingerprint)
	select {
	case ok := <-reply:
		return ok, nil
	case <-ctx.Done():
		return false, ctx.Err()
	}
}

// askSecret raises a secret prompt and blocks until answered or ctx is
// cancelled. A nil reply (or nil Callbacks) means the user cancelled auth and
// yields ErrCanceled.
func (e *Engine) askSecret(ctx context.Context, sessionID, kind, prompt string, echo bool) ([]byte, error) {
	if e.cb == nil {
		return nil, ErrCanceled
	}
	reply := make(chan []byte, 1)
	id := nextPromptID()
	e.prompts.mu.Lock()
	e.prompts.secret[id] = reply
	e.prompts.mu.Unlock()
	defer func() {
		e.prompts.mu.Lock()
		delete(e.prompts.secret, id)
		e.prompts.mu.Unlock()
	}()

	e.cb.OnSecretPrompt(id, sessionID, kind, prompt, echo)
	select {
	case secret := <-reply:
		if secret == nil {
			return nil, ErrCanceled
		}
		return secret, nil
	case <-ctx.Done():
		return nil, ctx.Err()
	}
}

func (r *promptRegistry) resolveHostKey(id string, accept bool) {
	r.mu.Lock()
	ch := r.hostKey[id]
	delete(r.hostKey, id)
	r.mu.Unlock()
	if ch != nil {
		ch <- accept // buffered(1) — never blocks
	}
}

func (r *promptRegistry) resolveSecret(id string, secret []byte) {
	r.mu.Lock()
	ch := r.secret[id]
	delete(r.secret, id)
	r.mu.Unlock()
	if ch != nil {
		ch <- secret // buffered(1) — never blocks; nil signals cancel
	}
}
