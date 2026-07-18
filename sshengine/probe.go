package sshengine

import (
	"net"
	"strconv"
	"time"
)

// probeDefaultPort is used when the caller passes a non-positive port.
const probeDefaultPort = 22

// probeDefaultTimeout bounds one probe dial when the caller passes a
// non-positive timeout. Mirrors wharf-tui's probe.DefaultTimeout.
const probeDefaultTimeout = 3 * time.Second

// Probe TCP-dials host:port and reports reachability for the host-list status
// dot. It returns the dial RTT in milliseconds (minimum 1) on success, or -1
// when the dial fails (refused, unreachable, or timed out). port <= 0 defaults
// to 22; timeoutMs <= 0 defaults to 3000. Classification (online vs degraded)
// is done by the JS side so the threshold lives with the UI.
//
// This is a stateless package-level function (gomobile binds it as
// SshengineProbe): it needs no engine instance and is safe to call with no
// session. It mirrors wharf-tui's probe.Dial — a single net.DialTimeout with
// the connection closed immediately on success.
func Probe(host string, port int, timeoutMs int) int {
	if port <= 0 {
		port = probeDefaultPort
	}
	timeout := probeDefaultTimeout
	if timeoutMs > 0 {
		timeout = time.Duration(timeoutMs) * time.Millisecond
	}

	target := net.JoinHostPort(host, strconv.Itoa(port))

	start := time.Now()
	conn, err := net.DialTimeout("tcp", target, timeout)
	rtt := time.Since(start)
	if err != nil {
		// Refused, unreachable, or timed out — all "offline" for the UI.
		return -1
	}
	// We only care that the port is reachable; drop the connection immediately.
	conn.Close()

	ms := int(rtt.Milliseconds())
	if ms < 1 {
		// A sub-millisecond connect (e.g. loopback) still means "online"; report
		// the minimum meaningful RTT so callers can distinguish success from -1.
		ms = 1
	}
	return ms
}
