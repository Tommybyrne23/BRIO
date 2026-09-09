# briomobile

Expo Router / React Native app for BRIO. Signs in against **brioweb**'s Better Auth instance (sibling directory), then reads health data from Apple HealthKit and pushes it to brioweb's `health_samples` table.

## Prerequisites

- Node (matches whatever brioweb's engine expects — no separate pin here yet)
- Xcode, for iOS builds — an Apple ID signed into Xcode is enough for local development. **A paid Apple Developer Program membership is not required** to build/run with HealthKit locally (verified directly: a free "Personal Team" successfully adds the HealthKit capability in Xcode). Paid membership only becomes necessary for TestFlight/App Store distribution.
- brioweb running somewhere reachable from your device/simulator (see its README) — either locally via your Mac's LAN IP, or a deployed URL.

**This app cannot run in plain Expo Go.** Apple HealthKit is a native module (`@kingstinct/react-native-healthkit`), so it needs a custom dev client — see below.

## Local setup

```bash
npm install
cp .env.example .env.local        # set EXPO_PUBLIC_API_URL to brioweb's URL
npx expo prebuild -p ios --clean  # generates ios/ (gitignored, disposable — regenerate after any app.json/plugin change)
npx expo run:ios                  # builds + installs on a simulator or a connected/paired device
```

`EXPO_PUBLIC_API_URL` — for a physical device, use your Mac's LAN IP (`http://192.168.x.x:3000`), not `localhost` (the device is a separate network peer). For the iOS Simulator, `http://localhost:3000` also works since it shares the host Mac's network.

After the first build, `npx expo start` + reopening the already-installed dev client is enough for JS-only changes; re-run `npx expo run:ios` (or rebuild from `ios/*.xcworkspace` in Xcode) whenever native config changes (e.g. `app.json` plugins) or a free-tier provisioning profile expires (7 days).

## Project layout

```
app.json               # scheme "briomobile", bundle id/package "com.brio.briomobile", HealthKit config plugin
src/
  lib/
    auth-client.ts        # better-auth React client + @better-auth/expo's expoClient() plugin (SecureStore-backed session)
    healthkit.ts           # HealthKit read: auth request identifiers, anchored-query sync, POST to brioweb
  app/
    _layout.tsx             # root Stack
    index.tsx                 # home screen: HealthKit connect/sync UI, gated on auth session
    (auth)/sign-in.tsx, sign-up.tsx
```

## Talking to brioweb

- Auth: `authClient` (`src/lib/auth-client.ts`) mirrors brioweb's own client but adds `@better-auth/expo`'s `expoClient()` plugin, which stores the session in `expo-secure-store` and replays it as a `Cookie` header on every request through this client.
- **Gotcha**: `authClient.$fetch`'s configured `baseURL` is scoped to Better Auth's own routes (it appends `/api/auth`). To call a plain brioweb API route like `/api/health-samples`, you must pass an **absolute URL** (`` `${process.env.EXPO_PUBLIC_API_URL}/api/health-samples` ``) — better-fetch uses an absolute URL as-is, bypassing that base path, while the Expo plugin still attaches the session cookie regardless of target URL. See `src/lib/healthkit.ts` for the pattern.
- HealthKit sync (`src/lib/healthkit.ts`) uses HealthKit's anchored queries (incremental, per sample type) and persists each type's anchor in SecureStore, keyed by both the sample type **and** `EXPO_PUBLIC_API_URL`. So the first sync against a given backend backfills all history for the configured types (steps, active energy, heart rate, sleep), every sync after that only sends new/changed samples, and switching `EXPO_PUBLIC_API_URL` between local/dev/prod triggers a fresh backfill against each one independently rather than sharing sync progress across them. Each pushed sample carries HealthKit's own UUID as `externalId` so re-syncing the same data is idempotent server-side (see brioweb's `AGENTS.md`).

## Pointing at a deployed backend (e.g. Dokploy)

1. Edit `.env.local`: set `EXPO_PUBLIC_API_URL` to the deployed URL (e.g. brioweb's Dokploy URL — see its README's Deployment section).
2. **Restart Metro** — `EXPO_PUBLIC_*` vars are read from `.env.local` once, when the Metro/bundler process itself starts, not on every reload. If `npx expo start` (or the Metro instance `expo run:ios` launched) is already running, editing `.env.local` and reloading the app in-place does **nothing**; stop that process (Ctrl+C) and start it again so it re-reads the file.
3. No native rebuild is needed for this — it's a pure JS-level change, so you don't need `expo prebuild`/`expo run:ios` again, just a fresh Metro + an app reload (it'll usually reload automatically on relaunch).

Two things that follow from switching backends this way:
- **You'll need an account on that backend specifically** — sign-up/sessions don't carry over between brioweb deployments (each has its own Postgres). Sign up fresh (or use an existing account) on whichever one you just pointed at.
- **HealthKit sync starts over for that backend.** As noted above, sync anchors are scoped per `EXPO_PUBLIC_API_URL`, so the first sync against a newly-pointed-at backend does a full historical backfill rather than picking up where another backend's sync left off — expect a large first sync, not "no data."

## HealthKit notes

- iOS only for now — no Android/Health Connect equivalent yet.
- Read-only: `app.json`'s `@kingstinct/react-native-healthkit` plugin config sets `NSHealthUpdateUsageDescription: false` since this app never writes to HealthKit.
- Background delivery (syncing while the app isn't open) is deliberately **off** (`"background": false` in the plugin config) — foreground/manual sync only for now. The plugin supports it (it'll wire up `BackgroundDeliveryManager` in `AppDelegate.swift` automatically if you flip that flag), but it needs its own testing pass before relying on it.
- Simulator testing: HealthKit works in the iOS Simulator, but there's no real sensor data — open the Simulator's Health app and add sample data manually (steps, heart rate, active energy, a sleep entry) to test the sync.
