# wharf-ssh

Local Expo module bridging the gomobile-compiled Wharf SSH engine (`sshengine/`,
package `sshengine`) to JS. The TypeScript surface (`index.ts`, `contract.ts`) is the
frozen contract; `ios/` and `android/` are the native halves. Jest never touches the
native code — it maps every import to the in-memory fake (`index.node.ts`).

## Native engine artifacts

Both platforms link a prebuilt gomobile binding produced by
`scripts/build-ssh-engine.sh`:

| Platform | Artifact                                          | Committed? |
|----------|---------------------------------------------------|------------|
| iOS      | `ios/WharfSshEngine.xcframework`                  | **Yes** — the build script rsyncs it here after a successful iOS bind. |
| Android  | `android/libs/sshengine.aar`                      | **No** — only `libs/.gitkeep` is committed. |

The iOS xcframework is committed (33 MB) so an iOS build / CI needs no Go toolchain.
The Android `.aar` is **not** committed: building it requires an Android NDK, which is
not always present. `scripts/build-ssh-engine.sh` produces
`sshengine/dist/sshengine.aar` when an NDK is detected and rsyncs it into
`android/libs/`.

### Building the engine

```sh
scripts/build-ssh-engine.sh
```

- iOS bind runs whenever Xcode is available and refreshes
  `ios/WharfSshEngine.xcframework`.
- Android bind runs only when an NDK is found (`ANDROID_NDK_HOME` or
  `~/Library/Android/sdk/ndk/*`) and refreshes `android/libs/sshengine.aar`.

**An Android build fails until `android/libs/sshengine.aar` exists** — run the build
script with an NDK installed before `expo run:android` / an Android EAS build.

## Layout

- `ios/WharfSsh.podspec` — vendors the xcframework, depends on `ExpoModulesCore`.
- `ios/WharfSshModule.swift` — the Swift module (events + async functions).
- `android/build.gradle` — links `libs/sshengine.aar`.
- `android/src/main/java/expo/modules/wharfssh/WharfSshModule.kt` — the Kotlin module.

Both native modules implement the engine's `Callbacks` off the Go thread (a serial
queue/executor) and run the blocking `connect` on a dedicated background
queue/executor — see the header comments in each module for the threading contract.
