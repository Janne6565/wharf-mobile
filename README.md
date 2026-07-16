# Wharf Mobile

React Native + Expo companion app for [Wharf](https://wharf.jannekeipert.de) — your
SSH fleet in one pocket. A **direct-token client** (like the wharf-tui) that reuses the
wharf-web TypeScript crypto layer with native primitives, so private keys never leave
the device. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan.

> **Status: M6 (polish + release).** Auth, crypto, vault sync, projects, and the light
> admin flows are in place; M6 adds the full Settings + Keys screens, shared toasts,
> the brand app icon/splash, and the EAS release config. The SSH terminal is post-v1
> (M7). See [`docs/PLAN.md`](docs/PLAN.md).

## Stack

- **Expo SDK 57** (React Native 0.86, New Architecture) with CNG / prebuild + a custom
  **dev-client** (native crypto rules out Expo Go).
- **TypeScript** (strict), **Bun**, **Biome**.
- **expo-router** — `app/(tabs)/` is the 4-tab bar (Hosts, Projects, Keys, Settings).
- **NativeWind v4** styled to the design mock; **JetBrains Mono** via `@expo-google-fonts`.
- **Redux Toolkit** (UI state) + **TanStack Query** (server interactions).
- **Orval** generates the typed API client from `openapi.json`.
- **react-i18next** with typed, compile-time-checked resources (en + de).

## Development

```sh
bun install                 # install dependencies

# Native project is generated on demand (CNG); it is not committed:
bunx expo prebuild          # generate ios/ and android/ from app.config.js

bun run ios                 # build + run on the iOS simulator
bun run android             # build + run on an Android emulator
bun run dev                 # start Metro against an existing dev-client build
```

Because the app uses native modules (and, from M1, native crypto), **Expo Go is not
supported** — run through a dev-client build (`expo run:ios` / `expo run:android` or an
EAS development build).

### Environment

- `EXPO_PUBLIC_API_BASE` — backend origin. Defaults to `https://wharf.jannekeipert.de`
  (generated request paths already include the `/api/v1` prefix).

## Scripts

| Command | What it does |
| --- | --- |
| `bun run dev` | Metro + dev-client |
| `bun run ios` / `android` | build & run on a simulator/device |
| `bun run typecheck` | `tsc --noEmit` |
| `bun run lint` / `lint:fix` | Biome check / autofix |
| `bun run test` | Jest (jest-expo + RN Testing Library) |
| `bun run gen:api` | regenerate the Orval client from `openapi.json` |
| `bun run gen:icons` | regenerate the app icon + splash from the brand mark |

## API generation

`openapi.json` at the repo root is a committed copy of the wharf-backend spec. Re-sync it
from `../wharf-backend/openapi.json` and run `bun run gen:api`; the output under
`src/api/generated/` is a committed build artefact — never hand-edit it.

## Brand assets

The app icon, Android adaptive icon (foreground + monochrome), splash mark, and web
favicon are all derived from the Wharf `❯_` brand mark by `bun run gen:icons`, which
writes the source SVGs to `assets/brand/` and rasterises the PNGs into
`assets/images/` (via `sharp`). Edit the geometry in `scripts/generate-icons.mjs` and
re-run — never hand-edit the generated PNGs. `app.config.js` points at those PNG paths.

## Building & releasing (EAS)

Builds go through **EAS Build**; releases through **EAS Submit** to **TestFlight**
(iOS) and the **Play internal testing** track (Android). One-time setup:

```sh
bun add -g eas-cli        # or use `bunx eas-cli@latest`
eas login                 # log in to the Expo account (owner: janne6565)
```

The EAS project is already linked (`app.config.js` → `extra.eas.projectId`), so no
`eas init` is needed.

### First builds (per profile in `eas.json`)

```sh
# Dev-client build to develop on a device (internal distribution):
eas build --platform ios     --profile development
eas build --platform android --profile development

# Release-configured QA build, still installed via an internal link:
eas build --platform ios     --profile preview
eas build --platform android --profile preview

# Store build (TestFlight / Play internal); build number auto-increments:
eas build --platform ios     --profile production
eas build --platform android --profile production
```

> **First run is interactive.** The very first iOS build prompts you to sign in to
> Apple and lets EAS generate/manage the Distribution certificate + provisioning
> profile; the first Android build generates and stores the upload keystore. Those
> credentials are saved on EAS and reused on later builds — subsequent builds are
> non-interactive. (This step needs *your* Apple / Google credentials and cannot be
> run headless.)

### Submitting

Fill the placeholders in `eas.json` → `submit.production` first:

- **iOS** — `appleId` (your App Store Connect email), `ascAppId` (the app record's
  numeric Apple ID), `appleTeamId`. Create the app record once at
  [App Store Connect](https://appstoreconnect.apple.com) before the first submit.
- **Android** — `serviceAccountKeyPath`: a Google Play service-account JSON key with
  the *Release manager* role (Play Console → Setup → API access). Create the app in the
  Play Console first; keep the JSON out of git (local path or an EAS secret).

```sh
# Uploads the latest production build to TestFlight / Play internal:
eas submit --platform ios     --profile production
eas submit --platform android --profile production
```

On iOS the build lands in **TestFlight** (add internal testers in App Store Connect);
on Android it lands on the **internal testing** track (add testers by email in the Play
Console). Both first submissions are interactive (Apple 2FA / Play app selection).

### CI builds (GitHub Actions)

`.github/workflows/eas-build.yml` runs EAS builds from CI. Builds are gated on the
same `typecheck · lint · test` suite as `ci.yml`, then dispatched to EAS with
`--no-wait` (EAS builds on its own servers; the Actions job returns immediately —
watch progress on [expo.dev](https://expo.dev)).

**One-time setup:**

1. Run the **first build of each profile interactively from your machine** (see
   [First builds](#first-builds-per-profile-in-easjson) above) so EAS generates and
   stores the iOS Distribution certificate / provisioning profile and the Android
   upload keystore. CI cannot create these — it reuses the credentials saved on EAS.
2. Create an Expo **access token** at
   `https://expo.dev/accounts/janne6565/settings/access-tokens`.
3. Add it as a repo secret so CI can authenticate to EAS:

   ```sh
   gh secret set EXPO_TOKEN -R Janne6565/wharf-mobile
   ```

4. *(Optional)* Enable auto-submit on tag builds — only after the
   `submit.production` placeholders in `eas.json` are filled in and the store app
   records exist (see [Submitting](#submitting)):

   ```sh
   gh variable set EAS_AUTO_SUBMIT --body true -R Janne6565/wharf-mobile
   ```

   While this variable is unset (the default), tagging still builds production but
   does **not** submit — so an unconfigured store setup never fails a tag build.

**Manual builds:** GitHub → **Actions → EAS Build → Run workflow**, then pick a
`platform` (ios / android / all) and `profile` (development / preview / production).

**Ship production** (house convention — cutting a `vX.Y.Z` tag ships prod):

```sh
git tag v1.2.3
git push --tags
```

The tag push triggers a production build for **both** platforms. If
`EAS_AUTO_SUBMIT=true`, EAS also queues the TestFlight / Play internal submission
after each build finishes; otherwise submit manually with `eas submit` (see above).
Per house policy, releases go out through CI on a tag — never `eas build`/`submit`
from a local machine for a real release.

## What's next (M7 — post-v1)

The SSH terminal: a gomobile-compiled Go SSH engine behind an Expo Module with a
SwiftTerm / Termux-view emulator. Its own project-sized milestone — see `docs/PLAN.md`.
