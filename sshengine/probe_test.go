package sshengine

import (
	"net"
	"strconv"
	"testing"
)

// probeHostPort splits a listener address into host and numeric port.
func probeHostPort(t *testing.T, addr net.Addr) (string, int) {
	t.Helper()
	host, portStr, err := net.SplitHostPort(addr.String())
	if err != nil {
		t.Fatalf("split %q: %v", addr, err)
	}
	port, err := strconv.Atoi(portStr)
	if err != nil {
		t.Fatalf("atoi %q: %v", portStr, err)
	}
	return host, port
}

func TestProbeOnline(t *testing.T) {
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	defer ln.Close()
	// Accept-and-close in the background so the connect completes cleanly.
	go func() {
		for {
			c, err := ln.Accept()
			if err != nil {
				return
			}
			c.Close()
		}
	}()

	host, port := probeHostPort(t, ln.Addr())
	rtt := Probe(host, port, 0)
	if rtt < 1 {
		t.Errorf("rtt = %d, want >= 1", rtt)
	}
}

func TestProbeOfflineClosedPort(t *testing.T) {
	// Reserve a port, then close the listener so nothing answers on it.
	ln, err := net.Listen("tcp", "127.0.0.1:0")
	if err != nil {
		t.Fatalf("listen: %v", err)
	}
	host, port := probeHostPort(t, ln.Addr())
	ln.Close()

	rtt := Probe(host, port, 0)
	if rtt != -1 {
		t.Errorf("rtt = %d, want -1 for closed port", rtt)
	}
}

func TestProbeOfflineTimeout(t *testing.T) {
	// 203.0.113.0/24 (TEST-NET-3) is reserved and unroutable, so the dial can
	// only end in a timeout.
	rtt := Probe("203.0.113.1", 22, 50)
	if rtt != -1 {
		t.Errorf("rtt = %d, want -1 for unroutable host", rtt)
	}
}
