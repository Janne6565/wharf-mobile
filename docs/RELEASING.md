# Releasing Wharf Mobile

Store submission runs through **EAS Submit**. The guiding rule: **no account-specific
value is ever committed.** Both stores' credentials are uploaded to and stored by EAS,
so `eas.json` holds only policy (`track: internal`) and nothing identifying.

App identifiers, which the store records must match exactly:

| | Value |
|---|---|
| Bundle identifier / package | `de.jannekeipert.wharf` |
| EAS project | `janne6565/wharf-mobile` (`47bc9fd7-…`) |
| Version source | `appVersionSource: remote` — EAS owns build number / versionCode |

---

## One-time setup

### 1. Google Play

**a. Create the app record.** Play Console → *Create app*. Package name must be exactly
`de.jannekeipert.wharf`. EAS cannot create this for you.

**b. Create a service account.**

1. Play Console → *Setup → API access* → link a Google Cloud project.
2. In Google Cloud → *IAM & Admin → Service Accounts* → create one → *Keys* → *Add key*
   → **JSON** → download it.
3. Back in Play Console → *Users and permissions* → *Invite new users* → paste the
   service account's email → grant **Release manager** (needs *Create and edit draft
   releases* + *Release to testing tracks*).

The full walkthrough with screenshots: <https://expo.fyi/creating-google-service-account>

**c. Hand the key to EAS** — do not put it in the repo:

```sh
eas credentials --platform android
# → Service Credentials → Google Service Account Key → upload the JSON
```

Delete the downloaded JSON afterwards. It is a live release credential.

### 2. App Store Connect

**a. Create the app record.** App Store Connect → *My Apps* → **+** → New App, bundle ID
`de.jannekeipert.wharf`. Also cannot be created by EAS.

**b. Let EAS manage the API key** — preferred over an Apple ID + app-specific password,
because it is scoped to automation and doesn't carry your personal 2FA:

```sh
eas credentials --platform ios
# → choose "Set up your project to use an API Key for EAS Submit"
```

EAS creates the App Store Connect API key, stores it server-side, and uses it for every
submission. Nothing lands in `eas.json`.

> If you'd rather create the key yourself (App Store Connect → *Users and Access → Keys*,
> role **App Manager**), you can, but then `ascApiKeyPath` / `ascApiKeyIssuerId` /
> `ascApiKeyId` have to be supplied — put them in EAS environment variables, not in git.

**c. Set up iOS *build* credentials.** These are a **separate** set from the API key
above, and both are required:

| Credential | Used for | Set up by |
|---|---|---|
| App Store Connect API Key | *submitting* a finished build | step **b** |
| Distribution Certificate + Provisioning Profile | *signing the build itself* | this step |

An API key alone gets you a `--non-interactive` build failure that names only the
certificate:

```
Distribution Certificate is not validated for non-interactive builds.
Failed to set up credentials. Credentials are not set up. Run this command again in
interactive mode.
```

Generate them once, interactively — EAS logs into Apple and creates both:

```sh
eas credentials --platform ios
# → production → Build Credentials → set up a new Distribution Certificate
#   and Provisioning Profile
```

Equivalent shortcut: run `eas build --platform ios --profile production` **without**
`--non-interactive` once and accept the prompts. After that CI works unattended, because
the credentials live on EAS.

Android has no equivalent step: EAS generated its keystore automatically on the first
build (visible as *Build Credentials* in `eas credentials --platform android`).

---

## Releasing

The house convention (see the agents KB `cicd` skill) is **cut a tag = ship prod**. The
`EAS Build` workflow builds `production` for both platforms on any `v*.*.*` tag.

Submission is opt-in behind a repo variable, so tags keep building safely until the store
setup above is actually done:

```sh
gh variable set EAS_AUTO_SUBMIT --body true -R Janne6565/wharf-mobile
```

With it set, a tag push runs `eas build --auto-submit`: EAS builds, then queues the store
submission server-side. Without it, tags build only.

Ad-hoc runs go through the Actions *Run workflow* button (platform × profile), or locally:

```sh
eas build --platform android --profile production --auto-submit
eas submit --platform ios --latest      # submit an already-finished build
```

### First submission per store

- **Play:** the very first upload must reach the `internal` track (already configured).
  Play will not accept a production release until the app record's setup tasks — content
  rating, data safety, target audience, store listing — are complete.
- **App Store:** the first build takes an extra hop through TestFlight processing before
  it's assignable to testers. `companyName` may be required on the very first submission
  for a brand-new app.

---

## Verifying a build before you ship it

Status and artifact URL for any build:

```sh
eas build:view <build-id>
eas build:list --platform android --limit 5
```

The Android engine binding is compiled from source on the EAS worker (see
`modules/wharf-ssh/README.md`), so it's worth confirming it actually landed in a release
artifact rather than trusting a green status:

```sh
curl -fsSL -o build.apk "<Application Archive URL>"
unzip -l build.apk | grep libgojni      # expect all four ABIs
```

---

## Gotchas

- **`appVersionSource: remote`** means EAS owns the build number and `versionCode`;
  `production.autoIncrement` bumps them server-side. Don't hand-edit `version` in
  `app.config.js` expecting it to drive the store build number — it's the user-facing
  version string only.
- **Credentials live on EAS, not here.** A fresh clone can build and submit with no local
  key files. Inspect what's stored with `eas credentials`.
- **`EXPO_TOKEN`** (already set as a repo secret) is what lets CI talk to EAS. Rotate it
  at <https://expo.dev/accounts/janne6565/settings/access-tokens>.
