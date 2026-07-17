//go:build tools

// This file exists only to pin the gomobile bind runtime
// (golang.org/x/mobile/bind) as an explicit module dependency, so `go mod tidy`
// keeps it in go.mod — scripts/build-ssh-engine.sh needs it resolvable to run
// `gomobile bind`. The `tools` build tag excludes it from every normal build,
// vet, and test, so it never compiles into the engine.
package sshengine

import _ "golang.org/x/mobile/bind"
