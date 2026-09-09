# Expo HAS CHANGED

Read the exact versioned docs at https://docs.expo.dev/versions/v57.0.0/ before writing any code.

# Project-specific rules (briomobile)

## `ios/` is generated, gitignored, and disposable

This project has native code now (Apple HealthKit isn't available in Expo Go). `ios/` is regenerated from `app.json` + its `plugins` config via `npx expo prebuild -p ios --clean` — never hand-edit files under `ios/` (entitlements, Info.plist, AppDelegate) expecting them to survive; change the plugin config in `app.json` instead and re-run prebuild. It's gitignored on purpose (continuous native generation), so don't try to commit it.

## HealthKit capability works on a free Apple ID — verified, don't re-litigate

Confirmed directly: adding the HealthKit capability in Xcode with a free "Personal Team" (no paid Apple Developer Program) succeeds with no error, for local dev/simulator builds. A paid membership is only needed later for TestFlight/App Store distribution. If you hit an actual "does not support the HealthKit capability" error, the cause is something else (e.g. a non-personal/institutional team) — don't assume it means you need to pay.

## `authClient.$fetch`: relative paths only work for Better Auth's own routes

`createAuthClient({ baseURL })`'s internal `$fetch` resolves relative paths against `${baseURL}/api/auth` (Better Auth's own base path), not the app root — `authClient.$fetch("/api/health-samples", ...)` silently 404s as `/api/auth/api/health-samples`. To reach any other brioweb route, pass a full absolute URL (`` `${process.env.EXPO_PUBLIC_API_URL}/api/health-samples` ``); better-fetch uses an absolute URL as-is and the Expo client's fetch plugin still attaches the stored session cookie regardless of target URL. See `src/lib/healthkit.ts`/`src/app/index.tsx` for the working pattern.

## `EXPO_PUBLIC_*` env vars need a Metro restart, not just a reload

Metro reads `.env.local`/`.env` once, at its own process startup — not per bundle request. Editing `.env.local` (e.g. switching `EXPO_PUBLIC_API_URL` to point at a different brioweb deployment) and then just reloading the app in the simulator/dev client does nothing; the already-running Metro process still has the old value baked in. Stop it (Ctrl+C) and start it again (`npx expo start` or `npx expo run:ios`) so it re-reads the file. No native rebuild is needed for an env-only change like this — only a Metro restart.
