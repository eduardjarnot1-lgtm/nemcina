# Project status

Living status document. Rewritten 2026-09-15, replacing the Phase 1A
documentation audit — that audit described the repository as *documented*; this
one separates what has been **verified by running it** from what has not.

Target product: a commercial German-learning mobile app for Android and iOS.
Current reality: a working web prototype plus a tested engine. The gap is large
and is stated honestly below rather than smoothed over.

---

## 1. Verified this session

Everything in this section was executed, not read.

| Command | Result |
|---|---|
| `npm test --workspaces` | **78 passed, 0 failed** |
| `npx tsc --noEmit` (packages/core) | clean |
| `python3 app/tools/validate_content.py` | **PASSED** — 98 776 checks, 0 errors, 1 warning |

The one warning is long-standing and genuine: the source list prints
*einwerfen* twice with slightly different glosses, so both cards are kept and
flagged for a human.

---

## 2. What actually exists

### Content — solid, the strongest part of the project

| | Count | Provenance |
|---|---|---|
| Vocabulary cards | 4 768 | OCR GCSE list + Goethe A1/A2/B1 Wortlisten + Lingster A1–B2 |
| — levelled by a word list | 4 177 | a source's statement |
| — levelled by tier approximation | 591 | labelled "approx." everywhere it appears |
| Grammar topics | 121 | DaF kompakt (87), Sicher! C1 (32), CC BY-NC gap-fill (2) |
| Grammar exercises | 615 | |
| CEFR headwords with sources | 4 442 | |
| Frequency-ranked forms | 2 586 | OpenSubtitles corpus |

Levels: **A1 829 · A2 1 270 · B1 2 157 · B2 512.** C1 has grammar only, no
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
| real-data suite | The engine against the project's actual 4 768 cards | 9 |

Toolchain: **zero runtime dependencies.** Node 22 runs TypeScript tests
natively, so tests use `node:test` with no framework and no build step.
`typescript` and `@types/node` are devDependencies used only for type checking.

### `app/` — the working web prototype

Vanilla ES modules, no build step, `localStorage` persistence. Genuinely works:
vocabulary browsing by topic and by level, 121 grammar topics, lessons, review,
progress, search, frequency-ordered core words, speech in and out where the
browser supports it, and a single-file offline build.

It is a **prototype, not the product.** It is desktop-web shaped, has no
accounts, no sync, and no mobile shell.

---

## 3. What does NOT exist

Stated plainly, because spec §43 forbids calling these done.

| Area | Status |
|---|---|
| Mobile app (Android/iOS) | **Nothing.** No React Native project, no native shell. |
| User accounts | **Nothing.** No auth of any kind. `userId` is a local constant. |
| Cloud sync | **Nothing.** Progress lives in one browser's `localStorage`. |
| Backend / database | **Nothing.** No server, no Postgres, no API. |
| AI Learning Coach | **Not AI.** `app/src/coach.js` is deterministic rules over local data. No model call exists. |
| Subscriptions / premium | **Nothing.** |
| Advertising | **Nothing.** |
| Analytics | **Nothing.** |
| Audio | Browser speech APIs only; no stored pronunciation, no TTS provider. |
| Lesson units | Vocabulary is browsable but **not yet split into 10–20 item lessons** (§5). |
| Placement test | **Nothing.** |
| Onboarding | **Nothing.** |

---

## 4. Known problems

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
4. **PR #7 is still open and unmerged.** It restores the licensing boundary,
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
3. No accounts, so no cross-device progress — spec §47 requires it.
4. No backend, so no server-side validation of premium or AI limits (§31).

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

1. **Content repository + lesson units in the core.** Turn 4 768 cards into
   ordered lessons of 10–20 items per category (§5), with search (§24). Fully
   testable without a UI; unblocks both web and mobile.
2. **Decide the mobile stack and scaffold it.** React Native/Expo is the
   default given a TypeScript core.
3. **Backend + auth + sync.** The `ProgressStore` port is already the seam.
4. **Real AI coach** behind the controlled functions in §10 of the spec, with
   usage limits enforced server-side (§11).

---

## 8. Credentials and decisions still needed from the owner

Nothing here blocks the work above; placeholders are in place where needed.

| Needed | For | Blocking now? |
|---|---|---|
| Licensing decision or content replacement plan | Any public or paid release | **Yes, for release** |
| `OPENAI_API_KEY` (or chosen provider) | Real AI coach | Not yet — no backend to hold it |
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
npm test --workspaces                      # 78 tests
python3 app/tools/validate_content.py      # 98 776 checks
python3 -m http.server 8000                # then http://localhost:8000/app/
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
