#!/usr/bin/env bash
#
# Builds the Wharf mobile SSH engine (sshengine/) into native binding artifacts
# with gomobile bind:
#   iOS     -> sshengine/dist/WharfSshEngine.xcframework  (device + simulator)
#   Android -> sshengine/dist/sshengine.aar               (only if an NDK is found)
#
# The dist/ directory is git-ignored; artifacts are consumed by the Expo module.
set -euo pipefail

REPO_ROOT="$(cd "$(dirname "${BASH_SOURCE[0]}")/.." && pwd)"
ENGINE_DIR="$REPO_ROOT/sshengine"
DIST_DIR="$ENGINE_DIR/dist"
# The wharf-ssh Expo module consumes the binds from here. The iOS xcframework copy
# is committed (so an iOS build needs no Go toolchain); the Android .aar is not.
MODULE_IOS_DIR="$REPO_ROOT/modules/wharf-ssh/ios"
MODULE_ANDROID_LIBS_DIR="$REPO_ROOT/modules/wharf-ssh/android/libs"

echo "==> Wharf SSH engine build"
echo "    engine: $ENGINE_DIR"

# --- toolchain -------------------------------------------------------------
if ! command -v go >/dev/null 2>&1; then
  echo "!! go toolchain not found on PATH" >&2
  exit 1
fi
echo "    go:     $(go version)"

# gomobile/gobind must be on PATH. Install into GOBIN if missing.
GOBIN="$(go env GOBIN)"
[ -n "$GOBIN" ] || GOBIN="$(go env GOPATH)/bin"
export PATH="$GOBIN:$PATH"

if ! command -v gomobile >/dev/null 2>&1; then
  echo "==> installing gomobile + gobind (not found)"
  go install golang.org/x/mobile/cmd/gomobile@latest
  go install golang.org/x/mobile/cmd/gobind@latest
fi
# `gomobile version` self-tests against a go.mod in cwd and often prints noise;
# the x/mobile module version baked into the binary is the meaningful number.
gomobile_ver="$(go version -m "$(command -v gomobile)" 2>/dev/null \
  | awk '$1=="mod" && $2=="golang.org/x/mobile"{print $3}')"
echo "    gomobile: golang.org/x/mobile ${gomobile_ver:-unknown}"

# gomobile needs its NDK/toolchain state initialized once. Cheap to re-run.
echo "==> gomobile init"
gomobile init

mkdir -p "$DIST_DIR"
cd "$ENGINE_DIR"

# gomobile resolves the golang.org/x/mobile bind runtime from the module graph.
go get golang.org/x/mobile/bind >/dev/null 2>&1 || true

ios_ok="skipped"
android_ok="skipped"

# --- iOS -------------------------------------------------------------------
# Requires Xcode. iossimulator target keeps it usable on Apple-silicon sims.
if command -v xcodebuild >/dev/null 2>&1; then
  echo "==> building iOS xcframework"
  if gomobile bind -target ios,iossimulator -o "$DIST_DIR/WharfSshEngine.xcframework" . ; then
    ios_ok="ok"
    # Sync the fresh xcframework into the Expo module (the committed copy an iOS
    # build/CI links, so no Go toolchain is needed there).
    echo "==> syncing xcframework into $MODULE_IOS_DIR"
    mkdir -p "$MODULE_IOS_DIR"
    rsync -a --delete "$DIST_DIR/WharfSshEngine.xcframework" "$MODULE_IOS_DIR/"
  else
    ios_ok="FAILED"
  fi
else
  echo "==> iOS: skipped (xcodebuild not found)"
fi

# --- Android ---------------------------------------------------------------
# Only when an NDK is detectable, so a Mac without Android tooling still builds iOS.
detect_ndk() {
  if [ -n "${ANDROID_NDK_HOME:-}" ] && [ -d "${ANDROID_NDK_HOME}" ]; then
    echo "$ANDROID_NDK_HOME"; return 0
  fi
  local base="$HOME/Library/Android/sdk/ndk"
  if [ -d "$base" ]; then
    # newest installed NDK
    local latest
    latest="$(ls -1 "$base" 2>/dev/null | sort -V | tail -1)"
    if [ -n "$latest" ]; then echo "$base/$latest"; return 0; fi
  fi
  return 1
}

if NDK="$(detect_ndk)"; then
  echo "==> building Android aar (NDK: $NDK)"
  export ANDROID_NDK_HOME="$NDK"
  if gomobile bind -target android -androidapi 24 -o "$DIST_DIR/sshengine.aar" . ; then
    android_ok="ok"
    # Sync the fresh aar into the Expo module. This copy is NOT committed (needs an
    # NDK to produce); an Android build fails until it exists.
    echo "==> syncing sshengine.aar into $MODULE_ANDROID_LIBS_DIR"
    mkdir -p "$MODULE_ANDROID_LIBS_DIR"
    rsync -a "$DIST_DIR/sshengine.aar" "$MODULE_ANDROID_LIBS_DIR/"
  else
    android_ok="FAILED"
  fi
else
  echo "==> Android: skipped (no NDK found; set ANDROID_NDK_HOME or install ~/Library/Android/sdk/ndk/*)"
fi

# --- summary ---------------------------------------------------------------
echo
echo "==> build summary"
echo "    iOS:     $ios_ok"
echo "    Android: $android_ok"
if [ -d "$DIST_DIR" ]; then
  echo "    artifacts:"
  du -sh "$DIST_DIR"/* 2>/dev/null || echo "      (none)"
fi

# Fail the script if a target that was attempted failed.
if [ "$ios_ok" = "FAILED" ] || [ "$android_ok" = "FAILED" ]; then
  exit 1
fi
