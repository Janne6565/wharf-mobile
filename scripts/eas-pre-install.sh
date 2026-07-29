#!/usr/bin/env bash
#
# EAS Build `eas-build-pre-install` hook (wired from package.json).
#
# The SSH engine (sshengine/) is a Go library compiled to a native binding with
# gomobile. The Android aar is not committed, so the Gradle build regenerates it
# — which needs a Go toolchain. EAS worker images ship the Android SDK and NDK
# but not Go, so install it here.
#
# iOS needs nothing: its xcframework is committed.
set -euo pipefail

# Keep this in step with sshengine/go.mod and the local dev toolchain.
GO_VERSION="1.26.5"
GO_INSTALL_DIR="/usr/local/go"

if [ "${EAS_BUILD_PLATFORM:-}" != "android" ]; then
  echo "==> pre-install: platform '${EAS_BUILD_PLATFORM:-unknown}' needs no Go toolchain; skipping"
  exit 0
fi

if command -v go >/dev/null 2>&1 || [ -x "$GO_INSTALL_DIR/bin/go" ]; then
  echo "==> pre-install: Go already present; skipping install"
else
  # EAS Linux workers are x86_64; guard anyway so a future arm64 image is obvious.
  arch="$(uname -m)"
  case "$arch" in
    x86_64)  go_arch="amd64" ;;
    aarch64|arm64) go_arch="arm64" ;;
    *) echo "!! unsupported build-worker architecture: $arch" >&2; exit 1 ;;
  esac

  tarball="go${GO_VERSION}.linux-${go_arch}.tar.gz"
  echo "==> pre-install: installing Go ${GO_VERSION} (${go_arch})"
  curl -fsSL -o "/tmp/${tarball}" "https://go.dev/dl/${tarball}"
  sudo rm -rf "$GO_INSTALL_DIR"
  sudo tar -C /usr/local -xzf "/tmp/${tarball}"
  rm -f "/tmp/${tarball}"
fi

# PATH exported here does NOT survive into the later build phases, so the engine
# script probes /usr/local/go/bin itself. Verify the binary is usable now, while
# the failure is still cheap and legible.
"$GO_INSTALL_DIR/bin/go" version

echo "==> pre-install: Go ready; the wharf-ssh Gradle module will build the engine aar"
