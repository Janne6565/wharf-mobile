package sshengine

import (
	"io"
	"sync"
	"sync/atomic"
	"time"

	"golang.org/x/crypto/ssh"
)

const keepaliveInterval = 30 * time.Second

// sshSession is one live remote shell. Its output is pumped into the ring for
// the session's whole life and, in parallel, delivered to Callbacks.OnData.
type sshSession struct {
	id  string
	eng *Engine

	client *ssh.Client
	sess   *ssh.Session
	stdin  io.WriteCloser
	ring   *ring
	tee    *tee

	mu    sync.Mutex
	alive bool
	cols  int
	rows  int

	userClosed atomic.Bool // set by userClose so OnClosed reports a clean ("") end
	done       chan struct{}
	closeOnce  sync.Once
}

// start wires the pump, waiter, and keepalive goroutines and marks the session
// live. Called by dial once the shell is running.
func (s *sshSession) start(stdout, stderr io.Reader) {
	s.mu.Lock()
	s.alive = true
	s.mu.Unlock()

	// Pump goroutines: drain remote stdout+stderr into the tee (ring + OnData)
	// until EOF. The tee never errors, so io.Copy runs to completion.
	go func() { _, _ = io.Copy(s.tee, stdout) }()
	go func() { _, _ = io.Copy(s.tee, stderr) }()

	// Waiter: block on the remote shell exiting, then tear down exactly once.
	go func() {
		err := s.sess.Wait()
		_ = s.client.Close()
		s.end(err)
	}()

	// Keepalive is the only post-handshake watchdog: a failed ping means the
	// transport is gone, so close the client and let the waiter report it.
	go s.keepaliveLoop()
}

// end marks the session dead exactly once: closes done, unregisters, and fires
// OnClosed. errMsg is "" on a clean remote exit or a caller-initiated Close.
func (s *sshSession) end(err error) {
	s.closeOnce.Do(func() {
		s.mu.Lock()
		s.alive = false
		s.mu.Unlock()
		close(s.done)
		s.eng.remove(s.id, s)
		msg := ""
		if err != nil && !s.userClosed.Load() {
			msg = err.Error()
		}
		s.eng.cb.OnClosed(s.id, msg)
	})
}

// keepaliveLoop pings the server periodically; a failed send tears the session
// down (the connection is gone) by closing the client, which unblocks the
// waiter with a transport error.
func (s *sshSession) keepaliveLoop() {
	t := time.NewTicker(keepaliveInterval)
	defer t.Stop()
	for {
		select {
		case <-s.done:
			return
		case <-t.C:
			if _, _, err := s.client.SendRequest("keepalive@openssh.com", true, nil); err != nil {
				_ = s.client.Close()
				return
			}
		}
	}
}

// write forwards keystrokes to the remote stdin.
func (s *sshSession) write(data []byte) error {
	_, err := s.stdin.Write(data)
	return err
}

// resize updates the remote PTY window and remembers the new dimensions.
func (s *sshSession) resize(cols, rows int) error {
	s.mu.Lock()
	s.cols, s.rows = cols, rows
	s.mu.Unlock()
	// x/crypto's WindowChange takes (rows, cols).
	return s.sess.WindowChange(rows, cols)
}

// userClose terminates the session on the caller's request. The resulting
// OnClosed reports a clean end; the waiter goroutine does the bookkeeping.
func (s *sshSession) userClose() {
	s.userClosed.Store(true)
	if s.sess != nil {
		_ = s.sess.Close()
	}
	if s.client != nil {
		_ = s.client.Close()
	}
}
