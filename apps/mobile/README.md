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
| `e2e/smoke.mjs` | The app driven in a browser. |

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

It drives the web export, so the components, engine, storage adapter and router
under test are the shipped ones — but **nothing native is covered**: gestures,
the on-screen keyboard, notifications, and how any of it looks on a real device
still need a device.

## Not built yet

Accounts, cloud sync, subscriptions, ads, notifications, audio, a placement test
and onboarding. Grammar has no screen yet, though the topics are loaded and
searchable. `PROJECT_STATUS.md` in the repository root is the honest list.
