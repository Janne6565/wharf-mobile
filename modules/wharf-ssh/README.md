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
The Android `.aar` is **not** committed — gomobile output is not reproducible, so a
checked-in binding rewrites ~16 MB of unmergeable bytes on every rebuild even when no
source changed. It is built from `sshengine/*.go` on demand instead.

### Building the engine

`android/build.gradle` registers a `buildSshEngine` task that `preBuild` depends on, so
**no manual step is needed** — an Android build regenerates `libs/sshengine.aar`
whenever it is missing or older than any `sshengine/*.go`, and skips otherwise.

To drive it by hand:

```sh
scripts/build-ssh-engine.sh --android   # aar only
scripts/build-ssh-engine.sh --ios       # xcframework only
scripts/build-ssh-engine.sh             # both, as the toolchains allow
```

Always pass a target when you only want one: an unintended iOS rebuild shows up as ~35 MB
of phantom diff in the committed xcframework.

### Toolchain requirements (Android)

| Need | Local | EAS Build |
|------|-------|-----------|
| Go   | install any recent Go (gomobile is pinned by the script) | installed by the `eas-build-pre-install` hook, `scripts/eas-pre-install.sh` |
| NDK  | `sdkmanager --sdk_root="$ANDROID_HOME" 'ndk;27.1.12297006'` | preinstalled on the SDK 57 image (same version) |
| JDK  | **21** — a newer JDK fails AGP's CMake configure with `A restricted method in java.lang.System has been called`. Use `JAVA_HOME=$(/usr/libexec/java_home -v 21)`. | image default |

NDK `27.1.12297006` is not arbitrary: it is what React Native 0.86 pins
(`react-native/gradle/libs.versions.toml`), so one NDK serves both the gomobile bind and
the Gradle app build. The script also honours `ANDROID_NDK_HOME` / `ANDROID_NDK_ROOT` and
the standard SDK layouts on macOS and Linux.

## Layout

- `ios/WharfSsh.podspec` — vendors the xcframework, depends on `ExpoModulesCore`.
- `ios/WharfSshModule.swift` — the Swift module (events + async functions).
- `android/build.gradle` — links `libs/sshengine.aar`.
- `android/src/main/java/expo/modules/wharfssh/WharfSshModule.kt` — the Kotlin module.

Both native modules implement the engine's `Callbacks` off the Go thread (a serial
queue/executor) and run the blocking `connect` on a dedicated background
queue/executor — see the header comments in each module for the threading contract.
