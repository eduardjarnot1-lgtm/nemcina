# Němčina — the mobile app

React Native through Expo, for Android and iOS. The screens are thin: every
decision about what to ask, whether an answer is right and when a word comes
back lives in `@nemcina/core`, so the same behaviour is testable without a
device and cannot drift between platforms.

## Running it

```bash
npm install                 # from the repository root — this is a workspace
cd apps/mobile
npx expo start              # then press a for Android, i for iOS, w for web
```

`expo install` and `expo start` reach `api.expo.dev`. Where that host is
blocked, prefix commands with `EXPO_OFFLINE=1` and add packages with plain
`npm install -w @nemcina/mobile <pkg>@<version from expo/bundledNativeModules.json>`.

## What is here

| | |
|---|---|
| `app/` | Routes. Expo Router, file-based: `(tabs)` is the tab bar, `session/[lessonId]` is a study session. |
| `src/content.ts` | The only module that knows where the Python pipeline writes. |
| `src/course.tsx` | Loads the course once, after the first frame, and shares it. |
| `src/progress.tsx` | `ProgressStore` over AsyncStorage, behind a context. |
| `src/strings.ts` | Every word the interface says, in one table. |
| `src/account.tsx` | The signed-in account; the token lives in SecureStore, never AsyncStorage. |
| `src/preferences.tsx` | Session length and starting level. Local, deliberately not synced. |
| `src/api.ts` | The only place that knows the sync server's shape. |
| `e2e/smoke.mjs` | The app driven in a browser. |
| `e2e/sync.mjs` | The app, the server and two devices, driven together. |

The content is bundled rather than fetched, so the app works offline. That costs
about four megabytes and a parse on first launch.

## Testing

```bash
npx expo export --platform web --output-dir dist   # EXPO_OFFLINE=1 where needed
node e2e/smoke.mjs
```

The smoke test runs the real bundle in Chromium and walks the real flow: open a
lesson, answer it to the end, read the summary, reload and check the progress
survived, search for a word without an umlaut key. It skips with a message
rather than failing when there is no export or no browser.

```bash
PLAYWRIGHT_BROWSERS_PATH=/path/to/browsers node e2e/sync.mjs
```

`sync.mjs` is the whole stack: it starts the real server, exports the app
pointed at it, and drives two browser contexts. Study on one, register, sync;
sign in on the other, sync, and the work is there. It exports the app itself,
because the API URL is baked into the bundle at export time.

It drives the web export, so the components, engine, storage adapter and router
under test are the shipped ones — but **nothing native is covered**: gestures,
the on-screen keyboard, notifications, and how any of it looks on a real device
still need a device.

## Sync

`EXPO_PUBLIC_API_URL` names the sync server, and has **no default**: nothing is
deployed, and a hard-coded fallback would be a placeholder that quietly shipped.
Unset, the app says sync is unavailable and everything else still works — an
account is never a wall in front of the course.

```bash
EXPO_PUBLIC_API_URL=https://api.example.com npx expo start
```

## Onboarding

A new install opens on a welcome flow, not on lesson one of A1. It asks two
things, both of which change what the app does: how long a session should be
(it becomes the session's size) and where to start — answered by an adaptive
placement test of about twenty questions, or by skipping it and starting at A1.
Both are changeable afterwards on the profile.

## Not built yet

Subscriptions, ads, notifications and audio. No server is deployed, so sync
works only against one you run yourself.
`PROJECT_STATUS.md` in the repository root is the honest list.
