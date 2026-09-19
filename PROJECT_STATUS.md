# Project status

Living status document. Rewritten 2026-09-15, replacing the Phase 1A
documentation audit — that audit described the repository as *documented*; this
one separates what has been **verified by running it** from what has not.

Target product: a commercial German-learning mobile app for Android and iOS.
Current reality: a mobile app that runs, a tested engine behind it, a sync
server that works and is not deployed, and a content pipeline that refuses bad
input. What is still missing is stated below rather than smoothed over.

---

## 1. Verified this session

Everything in this section was executed, not read.

| Command | Result |
|---|---|
| `npm test --workspaces` | **386 passed, 0 failed** (297 core · 89 server) |
| `node apps/mobile/e2e/smoke.mjs` | **35 browser checks passed** |
| `node apps/mobile/e2e/sync.mjs` | **13 checks passed** — two devices, real server, real bundle |
| `npx tsc --noEmit` (core, server, mobile) | clean |
| `python3 app/tools/validate_content.py` | **PASSED** — 110 384 checks, 0 errors, 1 warning |

The one warning is long-standing and genuine: the source list prints
*einwerfen* twice with slightly different glosses, so both cards are kept and
flagged for a human.

---

## 2. What actually exists

### Content — solid, the strongest part of the project

| | Count | Provenance |
|---|---|---|
| Vocabulary cards | 4 646 | OCR GCSE list + Goethe A1/A2/B1 Wortlisten + Lingster A1–B2 |
| — levelled by a word list | 4 055 | a source's statement |
| — levelled by tier approximation | 591 | labelled "approx." everywhere it appears |
| Grammar topics | 121 | DaF kompakt (87), Sicher! C1 (32), CC BY-NC gap-fill (2) |
| Grammar exercises | 615 | |
| CEFR headwords with sources | 4 442 | |
| Frequency-ranked forms | 2 586 | OpenSubtitles corpus |

Levels: **A1 812 · A2 1 239 · B1 2 082 · B2 513** — 54, 83, 139 and 34 lessons
respectively, plus 138 lessons cut by topic category. 448 lessons in all. C1 has grammar only, no
vocabulary. C2 has nothing and says so — no level claims completeness it does
not have (spec §2).

The Python pipeline is reproducible and refuses to build on bad input: a grammar
example that does not occur verbatim in its own source text fails the build, and
the CEFR importer refuses below a 75 % verification rate against the official
PDFs.

### `packages/core` — new this session

Platform-agnostic learning engine. No DOM, no network, no storage backend, no
German-specific branching.

| Module | What it owns | Tests |
|---|---|---|
| `types.ts` | Domain model; language-specific metadata typed per target language | — |
| `srs.ts` | FSRS-5 scheduling | 16 |
| `answers.ts` | Lenient answer checking + FSRS grade inference | 16 |
| `selection.ts` | Session planning (§8) and exercise difficulty ladder (§7) | 20 |
| `storage.ts` | `ProgressStore` port + in-memory and key-value implementations | 17 |
| `content.ts` | `ContentRepository` port, filters and search (§24) | 20 |
| `lessons.ts` | Lesson units of 10–20 items and progress through them (§5) | 26 |
| `pipeline.ts` | The typed boundary to the Python pipeline's JSON | 17 |
| `exercises.ts` | Building a question: distractors, gaps, direction | 23 |
| `session.ts` | One study session, including the retry of a failed item | 17 |
| `stats.ts` | Totals, streaks, daily activity | 15 |
| `grammar.ts` | Practising a topic: order, grading, the explanation | 19 |
| `sync.ts` | The merge rule: the later review wins | 13 |
| `placement.ts` | The adaptive placement test | 19 |
| `coach.ts` | The coach's evidence, and advice derived from it | 19 |
| `achievements.ts` | XP, levels and achievements, all derived from the attempt log | 19 |
| `syncClient.ts` | The client half of sync, transport injected | — |
| real-data suite | The engine against the project's actual 4 637 cards | 20 |

Toolchain: **zero runtime dependencies.** Node 22 runs TypeScript tests
natively, so tests use `node:test` with no framework and no build step.
`typescript` and `@types/node` are devDependencies used only for type checking.

### `apps/mobile` — the Android and iOS app

Expo Router over React Native, consuming `@nemcina/core`. Working today:
the next lesson on opening, a study session that runs to a summary with the
question form rising as an item is learned, wrong answers returning easier,
progress written per answer to AsyncStorage, search across words and grammar,
lessons browsable by level and by topic, all 121 grammar topics with their
explanations and 615 exercises, a coach that speaks only from the learner's own
answers, levels and achievements recomputed from the attempt log, spoken German
where the device has a voice, a profile with totals, a streak and a progress reset, an account that
carries progress between devices, and a welcome flow
with an adaptive placement test that decides where lessons start and how long
a session is.

`e2e/smoke.mjs` drives all of that in Chromium against the real bundle and
asserts 35 things about it; `e2e/sync.mjs` starts the real server, exports the
app against it and drives two browser contexts through registering, syncing and
finding the work on the second device. **It has never been run on a physical device**, so
nothing native — gestures, the keyboard, layout on a real screen, performance
on a cheap phone — has been seen by anyone.

### Accounts — two backends, one chosen at runtime

There are two ways to hold an account, and the app picks between them without
being configured:

| Backend | Chosen when | Used by |
| --- | --- | --- |
| `server` | `EXPO_PUBLIC_API_URL` is set | nothing yet — nothing is deployed |
| `firebase` | it is not, and Firebase is configured | the mobile app and the published build |
| `none` | neither | the account panel says so plainly |

`apps/mobile/src/account.tsx` holds that choice in `accountBackend()`. Firebase
is reached through `src/firebaseAuth.ts`. The SDK is imported statically: it
was loaded on demand at first, but the account context asks who is signed in as
soon as the app mounts, so measured in a browser every chunk was fetched before
any interaction. The deferral deferred nothing and cost a split bundle, whose
chunk map Metro resolves against a page URL the host assigns.

Both clients write to the same project (**master-german**) and the same path,
so one person has one account across the prototype and the app. Deleting an
account from the panel is not offered on Firebase: it needs a recent
re-authentication the panel does not ask for, so it signs out instead.

`firestore.rules` scopes every document to its owner's UID. **Committing that
file does not deploy it** — see `FIREBASE.md`, which also explains why the
`apiKey` in the client is not a secret.

### `packages/server` — accounts and sync

Holds what a phone must not be trusted with (§31): identity, session lifetime,
entitlements, and the coach's prompt and quota. It schedules nothing. Opaque revocable tokens rather than
JWTs, scrypt at the OWASP parameters, length as the only password rule, and
identical answers for a wrong password, an unknown address and one already
registered. A client may only write its own rows and can never assert its own
tier. One runtime dependency (`@anthropic-ai/sdk`, confined to one file); otherwise
`node:http`, `node:crypto` and `node:sqlite` alone.

**Nothing is deployed.** There is no hosting, no domain and no certificate, so
the mobile app talks to no server unless you run one yourself.

### `app/` — the working web prototype

Vanilla ES modules, no build step, `localStorage` persistence. Genuinely works:
vocabulary browsing by topic and by level, 121 grammar topics, lessons, review,
progress, search, frequency-ordered core words, speech in and out where the
browser supports it, and a single-file offline build.

It is a **prototype, not the product.** It is desktop-web shaped and has no
mobile shell. It does now have accounts: email/password and Google through
Firebase, writing progress to `users/{uid}/progress/{itemId}`.

---

## 2b. Motion and feedback (added this session)

**`apps/mobile/src/motion.ts`** is the single source for durations, curves and
animations, as `theme.ts` is for colour. Screens never write their own timings.

    duration   instant 70 · fast 140 · normal 220 · slow 320 · celebration 600
    easing     standard · enter · exit · spring
    hooks      useReducedMotion · usePressScale · useEntrance · useShake
               usePulse · useCountUp · useProgressScale

Two rules hold everywhere:

* **Only `transform` and `opacity` are animated**, with `useNativeDriver`, so a
  lesson keeps frame rate while the JS thread saves progress. The progress bar
  scales a full-width fill rather than animating `width` — a composite per
  answer instead of a layout pass.
* **Reduced motion removes movement rather than shortening it.** The state
  change still happens, instantly and completely.

**`apps/mobile/src/haptics.ts`** exposes four meanings — `selection`,
`success`, `warning`, `achievement` — not four APIs. No-ops on web, honours the
new `haptics` preference (toggle in Profile). A wrong answer uses the *warning*
pattern, never `Error`.

### Implemented

| Area | What it does |
|---|---|
| Buttons, options, cards | Scale under the finger; press-in fires before the answer is checked |
| Correct answer | One soft pulse + success haptic |
| Wrong answer | One short shake + warning haptic; gentle by design |
| Question changes | Fade-and-rise; no frame-swap |
| Progress bar | Travels to its new value |
| Session end | Three staggered parts, numbers count up, stronger headline and haptic for a perfect session |
| Home screen | Assembles top-down, then stops |

### What remains

* **Master Fuka has no animated states.** The mascot exists in the web
  prototype only; the mobile app has no asset. `Reveal` and the haptic levels
  are the hooks a future mascot would use — nothing was faked in the meantime.
* **No sound.** A `sound` preference is stored and defaults **off**; there are
  no audio assets. A setting that promises a sound it cannot play is worse than
  no setting.
* **No XP-fly-to-counter animation.** The core has real XP (`xpFor`,
  `totalXp`, `levelFor`), but the session screen does not yet show a running
  XP total to fly toward, and inventing one would be a feature, not polish.
* **No streak or daily-goal animation.** `streak()` is real data and the
  profile shows it; neither is on the lesson path yet.
* **No course-map or unlock animation.** The lesson list is a flat list, not a
  map, so there is no locked→unlocked transition to animate.
* **Achievements are listed, not celebrated.** `achievements()` and `earned()`
  exist; nothing watches for the moment one is first earned.
* **No analytics events.** `lesson_started`, `lesson_completed` and the rest
  are not emitted anywhere; there is no analytics layer to emit them to.

### Known animation issues

* `useCountUp` drives its value through a JS listener, because a number has to
  reach JavaScript to be rendered as text. It runs for a fraction of a second,
  once, on the results screen — never during a lesson.
* Verified in a browser at 420×900, normal and reduced motion: a 21-answer
  session, no console errors, no blocking, slowest answer round trip 316ms
  normal / 113ms reduced. Not yet verified on a physical device — see §4.

### Future asset requirements

* Master Fuka: idle, happy, celebrating, thinking, encouraging, surprised,
  lesson-complete. Lottie or sprite; the component boundary is `Reveal`.
* Sounds: correct, incorrect, lesson complete, achievement, level unlock.
  Short, soft, optional.

## 3. What does NOT exist

Stated plainly, because spec §43 forbids calling these done.

| Area | Status |
|---|---|
| Deployment | **Nothing.** The server runs locally and is not hosted anywhere, so sync works only against one you start yourself. |
| Email verification / password reset | **Nothing.** Both need a mail provider — a decision and a credential nobody has supplied. |
| AI Learning Coach | **Built, unkeyed.** Evidence and advice are computed from the learner's records; the server will ask Claude to phrase them, under a closed intent list and a server-side quota. No `ANTHROPIC_API_KEY` is set, so it answers `no-model-configured` and the app shows its own advice. |
| Subscriptions / premium | **Half.** The server owns the entitlement, will not let a client claim it, and premium now buys something real (50 coach requests a day against 5). Nothing sells one and no store receipt is verified. |
| Advertising | **Nothing.** |
| Analytics | **Nothing.** |
| Audio | Both use the platform's own synthesiser. No recorded pronunciation, no TTS provider, no pronunciation scoring. |
| Notifications | **Nothing.** |
| App icons | Expo template placeholders. |

---

## 4. Known problems

0. **The content bug found by running the app.** 1 293 cards were glossed with
   the translation of their example sentence rather than of the word, because
   the Goethe transcription's third column translates the sentence. Fixed in
   `build_cefr.py`, and `validate_content.py` now refuses to build data with
   that shape. Worth recording because it was invisible to every unit test and
   obvious within one screen of the running app.
1. **The learning logic now exists twice.** `app/src/srs.js` and
   `packages/core/src/srs.ts` implement the same FSRS-5. The web app was not
   rewired to the core in this change, deliberately — the app has no build step
   and the core is TypeScript. **This will drift if left.** Resolution options
   are in §6.
2. **`app/src/coach.js` is named "Learning Coach" but is not AI.** The UI and
   README say so explicitly, so it is not deceptive, but the name invites the
   wrong expectation.
3. **B2 vocabulary rests on a single source** (Lingster Academy). Its level
   judgements are one publisher's, and some look high. The official Goethe B2
   Wortliste could not be obtained — `goethe.de` is blocked from the build
   environment.
4. **A published build once carried a localhost API URL.** `e2e/sync.mjs`
   exports the app with `EXPO_PUBLIC_API_URL` pointing at its own throwaway
   server. Metro inlines that value and **caches the transformed module**, so
   every later `expo export` without `--clear` silently reused it. The build
   that was published this way tried to reach a server on the reader's own
   machine, which is why creating an account reported "Could not reach the
   server" instead of using Firebase. Fixed by exporting with `--clear`;
   `tools/prepare-web-artifact.mjs` now reads the compiled `API_URL` back out
   of the bundle and refuses to prepare one that points at the build machine.
5. **PR #7 is still open and unmerged.** It restores the licensing boundary,
   the `german/` docstring fix and the Netlify removal that were approved but
   stranded when PR #2 merged early. Until it lands, `main` has **no rule**
   saying the repository stays private and unmonetised.

---

## 5. Release blockers

In the order they block a store submission.

1. **Licensing.** 119 of 121 grammar topics and most example sentences come from
   paid Klett and Hueber coursebooks and Goethe-Institut lists, with no
   permission. Two topics are CC BY-NC (non-commercial only). **A paid or
   publicly listed app cannot ship this content as it stands.** See
   `app/ZDROJE.md`. This is the single largest blocker and it is legal, not
   technical.
2. No mobile application exists.
3. No backend of our own, so no server-side validation of premium or AI limits
   (§31). Accounts and cross-device progress (§47) now work through Firebase,
   which covers identity and sync but not entitlements — a phone must not be
   trusted to assert its own tier, and against Firestore alone it would be.
4. **The Firestore rules have not been confirmed deployed.** Until someone runs
   `firebase deploy --only firestore:rules` and checks the console, the
   database may still be in test mode, which is world-readable and -writable
   until its expiry and denies everything after. See `FIREBASE.md`.

---

## 6. Architectural decisions taken

| Decision | Why |
|---|---|
| Extract the engine into `packages/core` before building any mobile UI | Otherwise the mobile app copies the logic and the copies drift. |
| TypeScript + `node:test`, no test framework | Node 22 runs TS natively; a framework would be a dependency solving no problem (§44). |
| `ProgressStore` as a port, async even where local storage is sync | The implementation that matters later is the network. Making it async now avoids rewriting every call site. |
| Mastery from scheduler stability, not attempt counts | "Mastered" should mean the scheduler will leave it alone for two months, not that a counter hit three. A lapse then correctly demotes it. |
| Grade inferred from the answer, never self-rated | Self-rating is the step users skip. |
| Language-specific metadata typed per target language | Adding Spanish must not touch the scheduler (§20). |

### Open decision: how the web app consumes the core

Three options, none yet chosen:

- **(a)** Emit JS from `tsc` into `app/vendor/` and commit it. Keeps the app's
  no-build-step property; puts generated code in git.
- **(b)** Give `app/` a small bundler. Costs the no-build-step property.
- **(c)** Freeze `app/` as the prototype and let the mobile app be the only
  consumer of the core. Accepts the duplication until the prototype is retired.

**(c) is the current de-facto state and the recommendation** if mobile work
starts immediately, since the prototype then has a short remaining life. If
mobile work is delayed, (a) is better than leaving two copies drifting.

---

## 7. Next priorities

1. ~~Content repository + lesson units in the core.~~ **Done.**
2. ~~Decide the mobile stack and scaffold it.~~ **Done** — Expo Router, running
   and tested end to end in a browser.
3. **Run it on a real device.** Everything so far is verified through the web
   export. Nothing native — gestures, keyboard, layout on a real screen — has
   been seen. This is the next thing that can prove or disprove the app.
4. ~~A grammar screen.~~ **Done.**
5. ~~Backend + auth + sync.~~ **Done** — `packages/server`, and the app signs in
   and syncs. Not deployed.
6. **Deploy the server.** Needs a host, a domain and a certificate; all three
   are decisions, not code. Until then sync is real but unreachable.
7. ~~Real AI coach.~~ **Built** — closed intents, prompts written server-side,
   quotas counted server-side, and no model configured. Needs a key and the
   deployment above to be reachable.
8. ~~Onboarding and a placement test.~~ **Done** — an adaptive test places a
   learner in about twenty questions, and the app opens on a welcome flow
   rather than on lesson one of A1.

---

## 8. Credentials and decisions still needed from the owner

Nothing here blocks the work above; placeholders are in place where needed.

| Needed | For | Blocking now? |
|---|---|---|
| Licensing decision or content replacement plan | Any public or paid release | **Yes, for release** |
| **Deploying the Firestore rules, and confirming it in the console** | Keeping one learner's progress out of another's hands | **Yes.** `firebase deploy --only firestore:rules` — see `FIREBASE.md`. Cannot be done from the build environment; Google is blocked from it. |
| A host, a domain and a TLS certificate | A sync server of our own. Accounts themselves work through Firebase. | Not for accounts; yes for server-side entitlements |
| A mail provider | Email verification and password reset against our own server. Firebase can send both; neither is wired up. | Not yet |
| `ANTHROPIC_API_KEY` | The coach's phrasing. Without it the app shows its own advice and says so. | Not blocking |
| Apple Developer / Google Play accounts | Store submission | Not yet |
| AdMob identifiers | Advertising | Not yet |
| Subscription product IDs | Premium | Not yet |

---

## 9. Resuming work

A new session has no memory of previous ones and will not continue on its own.

> Pracuješ na repozitáři `eduardjarnot1-lgtm/nemcina`. Přečti si
> `PROJECT_STATUS.md`, `CLAUDE.md` a `COLLABORATION.md` a pokračuj od sekce
> „Next priorities". Nic nepushuj do `main`, pracuj na feature větvi.

```bash
git clone https://github.com/eduardjarnot1-lgtm/nemcina /home/user/nemcina
cd /home/user/nemcina
npm install
npm test --workspaces                      # 394 tests
python3 app/tools/validate_content.py      # 86 264 checks
python3 -m http.server 8000                # then http://localhost:8000/app/

cd apps/mobile && EXPO_OFFLINE=1 npx expo start   # the mobile app
npm start -w @nemcina/server                      # the sync server
```

Source documents are **not** committed — only derived data. To re-run the
extractors, fetch the inputs again:

```bash
git clone --depth 1 https://github.com/technologiestiftung/sprach-o-mat.git        # Goethe A1/A2/B1 PDFs
git clone --depth 1 https://github.com/ilkermeliksitki/goethe-institute-wordlist.git
git clone --depth 1 https://github.com/Hazrat-Ali9/Deutschland-Vocabulary-A1-B2.git   # Lingster
git clone --depth 1 https://github.com/SavSanta/ding-de.git                         # Ding dictionary
git clone --depth 1 https://github.com/abdullahbutt/deutsch-lernen-goethe-a1-c2.git  # CC BY-NC grammar
```

**Environment limits:** `github.com` works via `git clone`; `goethe.de`,
`chatgpt.com`, `api.openai.com`, Wikipedia/Wiktionary, `archive.org` and
`huggingface.co` are blocked by the egress policy. That is why B2 rests on a
single source.
