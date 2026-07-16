# Wharf Mobile

React Native + Expo companion app for [Wharf](https://wharf.jannekeipert.de) — your
SSH fleet in one pocket. A **direct-token client** (like the wharf-tui) that reuses the
wharf-web TypeScript crypto layer with native primitives, so private keys never leave
the device. See [`docs/PLAN.md`](docs/PLAN.md) for the full plan.

> **Status: M0 (scaffold + shell).** Tab shell, theme, i18n, state, and API layer are
> in place. Crypto, auth, and vault sync land in M1+.

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
bunx expo prebuild          # generate ios/ and android/ from app.config.ts

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

## API generation

`openapi.json` at the repo root is a committed copy of the wharf-backend spec. Re-sync it
from `../wharf-backend/openapi.json` and run `bun run gen:api`; the output under
`src/api/generated/` is a committed build artefact — never hand-edit it.

## What's next (M1)

The crypto spike ports the wharf-web crypto layer verbatim above a swapped
`primitives.ts` (react-native-libsodium + native argon2 + @noble/hashes), proven by the
same Go-generated fixtures (`vault-fixture.json`, `project-fixture.json`) run both under
Jest (Node primitives) and on-device via a self-test screen. See `docs/PLAN.md` §C.
