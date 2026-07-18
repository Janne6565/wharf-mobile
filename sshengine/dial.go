package sshengine

import (
	"context"
	"net"

	"golang.org/x/crypto/ssh"
)

// PTY baud rate reported to the server. Cosmetic; matches the wharf-tui engine.
const ptyBaud = 14400

// dial connects, authenticates, requests a PTY, starts the remote shell and
// the output pump, and registers the session under sessionID. ctx bounds the
// whole dial+handshake+auth; once it returns nil the session runs until it
// ends or is closed.
func (e *Engine) dial(ctx context.Context, sessionID, host, addr, user, storedPassword, termType, authMethod string, keys []vaultKey, cols, rows int) (*sshSession, error) {
	db, err := e.openKnownHosts()
	if err != nil {
		return nil, err
	}

	config := &ssh.ClientConfig{
		User:              user,
		Auth:              e.authMethods(ctx, sessionID, user, host, storedPassword, authMethod, keys),
		HostKeyCallback:   e.hostKeyCallback(ctx, sessionID, db),
		HostKeyAlgorithms: db.HostKeyAlgorithms(addr),
	}

	var dialer net.Dialer
	conn, err := dialer.DialContext(ctx, "tcp", addr)
	if err != nil {
		return nil, err
	}

	// ssh.NewClientConn takes no context, so bound the handshake+auth by closing
	// the conn if ctx fires (covers both the connect deadline and CancelConnect).
	// After NewClientConn returns we check ctx.Err() to report canceled/timeout
	// rather than the resulting generic "closed connection".
	hsDone := make(chan struct{})
	go func() {
		select {
		case <-ctx.Done():
			_ = conn.Close()
		case <-hsDone:
		}
	}()

	sshConn, chans, reqs, err := ssh.NewClientConn(conn, addr, config)
	close(hsDone)
	if err != nil {
		_ = conn.Close()
		return nil, classifyHandshakeErr(err)
	}
	client := ssh.NewClient(sshConn, chans, reqs)

	sess, err := client.NewSession()
	if err != nil {
		_ = client.Close()
		return nil, err
	}

	modes := ssh.TerminalModes{
		ssh.ECHO:          1,
		ssh.TTY_OP_ISPEED: ptyBaud,
		ssh.TTY_OP_OSPEED: ptyBaud,
	}
	// Note the (rows, cols) argument order x/crypto uses here.
	if err := sess.RequestPty(termType, rows, cols, modes); err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, err
	}

	stdin, err := sess.StdinPipe()
	if err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, err
	}
	stdout, err := sess.StdoutPipe()
	if err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, err
	}
	stderr, err := sess.StderrPipe()
	if err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, err
	}

	if err := sess.Shell(); err != nil {
		_ = sess.Close()
		_ = client.Close()
		return nil, err
	}

	r := newRing(ringSize)
	s := &sshSession{
		id:     sessionID,
		eng:    e,
		client: client,
		sess:   sess,
		stdin:  stdin,
		ring:   r,
		tee:    newTee(r),
		cols:   cols,
		rows:   rows,
		done:   make(chan struct{}),
	}
	// The live sink is a callback adapter for the session's whole life: OnData is
	// the live path, Snapshot the reattach path.
	s.tee.setLive(&callbackWriter{id: sessionID, cb: e.cb})

	// Register before starting goroutines so a fast remote exit can't race its
	// own removal ahead of the insert.
	e.register(s)
	s.start(stdout, stderr)

	return s, nil
}
