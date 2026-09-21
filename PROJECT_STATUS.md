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
| Vocabulary cards | 5 484 | six lists written for this project |
| — levelled by a word list | 5 484 | every list states the level of its own words |
| — levelled by tier approximation | 0 | the fallback the GCSE list needed; nothing uses it now |
| Grammar topics | 136 | DaF kompakt (87), Sicher! C1 (32), written here (15), CC BY-NC gap-fill (2) |
| Grammar exercises | 690 | |
| Frequency-ranked forms | 2 586 | OpenSubtitles corpus, rank only |

Levels: **A1 600 · A2 854 · B1 983 · B2 1 774 · C1 1 273** — 40, 57, 66, 118 and
85 level lessons respectively, plus lessons cut by topic category. C2 has
nothing and says so — no level claims completeness it does not have (spec §2).

**C1 vocabulary is new and incomplete.** Three of four supplied parts are in:
1 500 of an announced 2 000 headwords, missing `clean-c1-0001`–`0500`. Adding
the fourth part is one more path on the extractor command and a rebuild.

The Python pipeline is reproducible and refuses to build on bad input: a grammar
example that does not occur verbatim in its own source text fails the build, an
extractor writes nothing unless every entry parses and the count matches
`--expect`, and `validate_content.py` fails on any card carrying a third-party
translation source.

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

It is a **prototype, not the product**, and it is now **frozen**: it is no
longer published anywhere and no further work goes into it. The code stays
because `app/data` (the corpus) and `app/tools` (the pipeline) live under the
same directory and are very much alive.

It has accounts — email/password and Google through Firebase, writing to
`users/{uid}/progress/{itemId}`, the same path the app uses — but it is
desktop-web shaped and has no mobile shell.

---

## 2b. Motion and feedback (added this session)

**`apps/mobile/src/motion.ts`** is the single source for durations, curves and
animations, as `theme.ts` is for colour. Screens never write their own timings.

    duration   instant 70 · fast 140 · normal 220 · slow 320 · celebration 600
    easing     standard · enter · exit · spring
    emphasis   soft 1.035 · strong 1.08
    hooks      useReducedMotion · usePressScale · useEntrance · useShake
               usePulse · useCountUp · useProgressScale · useEarned

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
| Answer runs | `3\u00D7 in a row` from three; no haptic, no pulse — the smallest reward in the app |
| XP and level | The earned figure counts up; the span beside it does not |
| Achievements | Strong pulse + haptic on the false-to-true edge only |
| Streaks | Milestones at 3, 7, 14, 30, 50, 100 days; silent between them |
| Choices | Shared `Selectable`: press scale, selection haptic, edge acknowledgement |
| Lesson list | Staggered by position |
| Coach | Three breathing dots while a reply is in flight, fade on arrival |
| Loading | Skeleton in the shape of a question, shimmer on opacity only |
| Empty states | Keyed on their message, so a second fruitless search re-announces |

**The reward hierarchy is the point**, not the individual animations. A run of
correct answers is almost silent; a correct answer pulses softly; a finished
session staggers and counts; a perfect one changes the headline and the haptic;
a badge or a streak milestone pulses strongly and buzzes. `usePulse` takes a
named strength precisely so this cannot drift into everything being equally
exciting, which is the same as nothing being.

**`useEarned` fires on edges, never on render.** Opening the profile does not
replay achievements the learner already had, and arriving at a screen with a
choice already made is silent. Re-announcing an old decision is noise.

### Sound and measurement — built, deliberately not switched on

**`src/sound.ts`** mirrors `haptics.ts` in shape: five cues, a `Player`
interface, and no player registered, so every call is a no-op. No audio library
is a dependency. `preferences.sound` already defaulted to off and still does —
a setting that promises a sound it cannot play is worse than no setting. What
this buys is that adding assets later touches one file.

**`src/analytics.ts`** records the learning funnel only: lesson started,
completed or abandoned, review started, streak extended, achievement unlocked.
Abandonment is detected on unmount when a started session never reached its
summary, so the wiring is real rather than decorative. **No sink is installed,
so nothing leaves the device.** There is no event for what was answered, which
word it was, or how long anyone hesitated — these describe a flow, not a
person. Installing a sink belongs in a privacy notice before it belongs in
code.

Without it, every future claim about whether a change helped is taste. "The
animations feel better" cannot be checked; "more sessions reach their summary"
can.

### What remains

* **Master Fuka has no animated states.** The mascot exists in the web
  prototype only; the mobile app has no asset. `Reveal`, `usePulse` and the
  haptic levels are the hooks a future mascot would use — nothing was faked in
  the meantime.
* **No audio assets.** `src/sound.ts` is the architecture; the five cues have
  nothing to play and the preference stays off until they do.
* **No XP flying to a counter.** The core has real XP (`xpFor`, `totalXp`,
  `levelFor`) and the profile animates it, but the session screen shows no
  running XP total to fly toward. Adding one is a feature, not polish.
* **There is no daily goal.** `preferences.dailyGoal` is the *length of a
  session*, not a daily XP target, so there is nothing to fill. Building a
  daily-goal system would be a new retention mechanic rather than motion work,
  and §30's near-goal messages are therefore driven by level XP instead, where
  the data is real.
* **No course map, so no unlock animation.** The lesson list is a flat list.
  Rows now arrive staggered, but there is no locked→unlocked transition
  because nothing is locked.
* **No unit or CEFR-level celebration.** The reward hierarchy stops at a
  perfect session; the course has no unit boundary to fire on.
* **Analytics has no sink**, by choice. The events are emitted; nothing
  receives them.
* **Never run on a physical device.** Everything below was verified through the
  web export in Chromium at phone width. Whether these animations hold frame
  rate on a cheap Android phone is unknown, and that is the single biggest
  open question about all of it.

### Known animation issues

* `useCountUp` drives its value through a JS listener, because a number has to
  reach JavaScript to be rendered as text. It runs for a fraction of a second,
  once, on the results screen — never during a lesson.
* `useCountUp` on the profile now runs on a screen the learner may scroll while
  it animates. It is capped at `duration.normal` there rather than
  `celebration`, so it is over before a scroll could fight it.
* `Thinking` and `Skeleton` both run `Animated.loop`. Both stop on unmount and
  neither starts at all under reduced motion, but a loop is a timer: if either
  is ever rendered in a list, that needs checking again.
* Verified in Chromium at 390×844, normal and reduced motion: every tab
  renders, a full session with correct answers driven from the shipped corpus
  (12 consecutive correct, the run badge appearing at 3 and climbing to 12,
  nothing at 1 or 2), three simultaneous taps on one answer rejected as a
  single submission, no console errors in either mode.
* Not yet verified on a physical device — see “What remains”.

### Future asset requirements

* Master Fuka: idle, happy, celebrating, thinking, encouraging, surprised,
  lesson-complete. Lottie or sprite; the component boundary is `Reveal`.
* Sounds: correct, incorrect, lesson complete, achievement, level unlock.
  Short, soft, optional.

## 2b-grammar. How a grammar topic is presented

The corpus is prose: a summary, headed explanation sections, rule sentences,
and examples with a short annotation. It carries **no tags**, so the topic page
had no way to tell a rule from a paragraph and rendered five identical cards in
source order. That is what made it a wall of text.

The page now answers three questions in the order they are asked — what is
this (summary), what must I remember (rules), what does it look like
(examples) — and puts the longer explanation after, because that is what you
read when the first three were not enough. **No content changed. Order and
weight did.**

`packages/core/src/grammarShape.ts` reads only the marks the corpus carries:

| Mark | Count | Rendered as |
|---|---|---|
| A rule opening `Achtung:` | 14 | A warning box, with the label dropped |
| `category` (20 values) | every topic | One of six grammatical families |

Families give the colour system. A hue means one thing everywhere — verbs are
one colour, the noun phrase another — and it is always **named in words beside
it**, so the colour groups and never informs. Six saturated colours on a screen
is a toy; these are muted and read as stationery.

Explanation sections past the first two fold behind a control that says how
many there are, because the count is what decides whether to open it.

### Tables and highlighting — built, by adding the missing data

Neither could be derived from the corpus, so both were built by putting the
missing piece into the pipeline instead of guessing at render time.

**Tables.** Exactly one of 626 rules is a full paradigm, so nothing could be
extracted. `app/tools/annotations/grammar/tables.json` holds ten tables —
article, `ein-`/`kein-`, personal pronouns, possessives, and the three
adjective-ending patterns — attached to the ten topics that teach those
systems. They are **written for this project**, and that is recorded in the
file and in the type. It is defensible because these are *closed* paradigms:
finite, fixed, and checkable against any reference grammar. Anything that is
usage rather than a closed system is not in there and stays prose.

The build refuses a ragged row and the validator re-checks every cell, because
a row shifted by one in a declension table is a wrong form, not a layout bug.

**Highlighting.** The question was always *which word*. The answer is in the
corpus: **a topic's own exercise answers are the forms it teaches.** A gap-fill
for the perfect tense answers with the participle; a conjugation choice answers
with the conjugated verb. So the build marks those forms in that topic's
examples, and `317 of 675` examples carry a highlight.

Only short answers from form-targeting exercises count — a reorder answer is
the whole sentence and would mark every word in it, place names included — and
a small English blocklist keeps `the` and `preterite` from being marked inside
the handful of examples that are English notes.

Spans are computed **once, at build time**, and stored as `[start, end)` pairs.
The app slices the string it was given and never runs a match of its own, so
what is highlighted was decided where it could be checked. The importer drops a
span that does not fit its sentence rather than clamping it, and the validator
fails on an out-of-range or overlapping span.

**Nothing identifies "the verb" or "the subject".** That needs a parser, and a
wrong guess teaches wrong grammar. An example the build could not mark is not
highlighted, which is a normal state.

The highlight is a tint **and** a weight change, so it survives greyscale.

**Grammar examples still have no translations.** The `note` is an annotation
naming the point ("regular ending -e"), not English, and is not laid out as a
translation.

Nothing infers a "common mistake", an "exception" or a comparison between two
structures. The corpus does not mark them.

---

## 2c. Publishing — one address, no hands

**https://eduardjarnot1-lgtm.github.io/nemcina/**

`.github/workflows/deploy-pages.yml` builds `apps/mobile` and deploys it on
every push to `main` touching the app, the engine or the corpus. There is
nothing to publish by hand and nothing to forget.

Pages serves from a folder, so `experiments.baseUrl` bakes the `/nemcina`
prefix in at build time — Expo's supported answer, and better than rewriting
paths afterwards because the router then writes real URLs. `404.html` is a copy
of the page, so an unknown path boots the app and it reads the URL: deep links
and reloads land on the right screen with the address intact.

Because the prefix is baked in, a Pages build works **only** under it. So it
comes from `EXPO_BASE_URL` through `app.config.js`, and only `build:pages` sets
it. The artifact build runs without it and is unchanged.

Two gates run before a deploy, and both have caught something real:

| Gate | Refuses |
|---|---|
| `validate_content.py` | Any card carrying a third-party translation source |
| `tools/assert-api-url.mjs` | A bundle with a loopback API URL baked in |

The second one lives in its own module precisely so both publishing routes run
it. Two ways to publish must not mean one of them is unguarded.

---

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
python3 app/tools/validate_content.py      # 165 695 checks
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
