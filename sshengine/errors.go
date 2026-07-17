package sshengine

import (
	"context"
	"errors"
	"fmt"
	"net"
	"strings"
)

// Internal sentinels. They are matched with errors.Is inside the engine and
// then mapped to the stable string codes below before crossing the bridge —
// the native side parses codes, not Go error identity.
var (
	// ErrHostKeyChanged: the server presented a host key differing from the one
	// in known_hosts. Never prompted — treated as a hard failure (possible MITM).
	ErrHostKeyChanged = errors.New("sshengine: host key changed")
	// ErrHostKeyRejected: the user declined to trust an unknown host key.
	ErrHostKeyRejected = errors.New("sshengine: host key rejected by user")
	// ErrCanceled: a prompt was cancelled (nil secret) or the attempt was
	// aborted (CancelConnect / no callbacks wired).
	ErrCanceled = errors.New("sshengine: canceled")
	// ErrAuthFailed wraps the handshake error when every auth method was rejected.
	ErrAuthFailed = errors.New("sshengine: authentication failed")

	// errUnknownSession is returned by Write/Resize for a missing session.
	errUnknownSession = errors.New("sshengine: unknown or closed session")
)

// Stable, parseable prefixes on the error Connect returns. The Swift/Kotlin
// bridge splits on the first ": " and switches on the code.
const (
	codeHostKeyChanged  = "host_key_changed"
	codeHostKeyRejected = "host_key_rejected"
	codeAuthFailed      = "auth_failed"
	codeCanceled        = "canceled"
	codeTimeout         = "timeout"
	codeNetwork         = "network"
	codeUnknown         = "unknown"
)

// classifyHandshakeErr maps a raw ssh.NewClientConn error onto the engine's
// sentinels. Host-key and cancellation sentinels raised inside the callbacks
// propagate through the handshake and are returned unchanged; a server
// rejecting every auth method becomes ErrAuthFailed.
func classifyHandshakeErr(err error) error {
	switch {
	case err == nil:
		return nil
	case errors.Is(err, ErrHostKeyChanged),
		errors.Is(err, ErrHostKeyRejected),
		errors.Is(err, ErrCanceled),
		errors.Is(err, context.Canceled),
		errors.Is(err, context.DeadlineExceeded):
		return err
	case strings.Contains(err.Error(), "unable to authenticate"):
		return fmt.Errorf("%w: %v", ErrAuthFailed, err)
	default:
		return err
	}
}

// connectError attaches a stable code prefix to the failure Connect reports.
// ctxErr is the attempt context's error (nil, context.Canceled, or
// context.DeadlineExceeded); it disambiguates a conn torn down by
// CancelConnect/timeout, whose raw err is only a generic "closed connection".
func connectError(err, ctxErr error) error {
	return errors.New(codeFor(err, ctxErr) + ": " + err.Error())
}

func codeFor(err, ctxErr error) string {
	var netErr net.Error
	isNet := errors.As(err, &netErr)
	switch {
	case errors.Is(err, ErrHostKeyChanged):
		return codeHostKeyChanged
	case errors.Is(err, ErrHostKeyRejected):
		return codeHostKeyRejected
	case ctxErr == context.Canceled || errors.Is(err, context.Canceled) || errors.Is(err, ErrCanceled):
		return codeCanceled
	case ctxErr == context.DeadlineExceeded || errors.Is(err, context.DeadlineExceeded) || (isNet && netErr.Timeout()):
		return codeTimeout
	case errors.Is(err, ErrAuthFailed):
		return codeAuthFailed
	case isNet:
		return codeNetwork
	default:
		return codeUnknown
	}
}
