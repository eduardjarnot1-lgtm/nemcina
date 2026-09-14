# Project status

**Scope of this document.** A documentation-level audit of the repository as it
stands, written for Phase 1A. It is based on the root `README.md`,
`app/README.md`, `COLLABORATION.md`, `CLAUDE.md` and an inspection of the file
tree. **No build, validation or test command was executed while writing it**, and
no data file was opened. Every number and behaviour below is therefore
*documented* rather than *verified in this pass*; claims that have not been
re-checked are marked as such. Verifying them is the first item of Phase 1B.

Last updated: 2026-09-14.

---

## 1. What the repository contains

```
README.md              project overview (Czech)
COLLABORATION.md       agent/human workflow rules (Czech)
CLAUDE.md              agent instructions
PROJECT_STATUS.md      this document
.github/workflows/     claude.yml (the only workflow)
app/                   the learning application
```

There is no `package.json`, no lockfile, no build tool config, no test
directory and no CI workflow other than the Claude agent workflow. The project
is a static site plus a Python content pipeline.

### `app/` layout

| Path | Contents |
|---|---|
| `app/index.html` | Application shell (top bar, search, main region) |
| `app/styles.css` | Light and dark theme, no CSS framework |
| `app/src/` | 16 ES modules, ~127 KB total — see the list below |
| `app/data/` | 4 generated JSON databases, ~6 MB total |
| `app/tools/` | Python extraction/build/validation pipeline, plus annotation sources |
| `app/assets/` | `master-fuka.jpg` (~414 KB) |
| `app/docs/` | `skills-integration-brief.md` |
| `app/ZDROJE.md` | Source and licence overview |
| `app/README.md` | The detailed technical document for the app |

### Source modules

`data.js`, `grammar.js` (loading and indexing), `db.js` (learner database),
`srs.js` (FSRS-5), `audio.js` (speech in/out), `progress.js`, `exercises.js`,
`lessons.js`, `coach.js`, `runner.js` (activity state machine), `search.js`,
`fuka.js`, `ui.js`, `views.js`, `learnViews.js`, `app.js` (hash router).

### Generated data

| File | Size on disk | Documented contents |
|---|---|---|
| `app/data/vocabulary.json` | ~4.05 MB | 4 768 cards, levelled A1–B2 |
| `app/data/cefr.json` | ~1.17 MB | 4 442 levelled headwords with sources |
| `app/data/grammar.json` | ~604 KB | 121 topics, 615 examples, 615 exercises |
| `app/data/frequency.json` | ~163 KB | 2 586 ranked word forms |

Sizes are from the file tree; counts are from `app/README.md` and were not
re-counted here.

---

## 2. Implemented features (as documented)

* **German Learning hub** — coach summary, four sections, target level.
* **Vocabulary** — topic → sub-topic → word type → card, with article, meaning,
  example sentence and English translation.
* **Grammar** — 121 topics A1–C1, grouped by level then by the source's own
  section, each with an English summary, rules, source examples and 4–7
  exercises.
* **Lessons** — a personalised mix of new words, weak words, overdue reviews and
  one grammar exercise, composed from the learner's own records.
* **Review** — everything the spaced-repetition schedule reports as due.
* **Progress** — per topic, per grammar unit, streak, XP, weak words, recent
  mistakes, recent sessions.
* **Core words** — cards carrying a subtitle-frequency rank, most frequent first.
* **Search** — German, English and grammar topics in one input.
* **Learning Coach** — deterministic recommendations computed from the local
  database; there is no language model at runtime.

**Exercise types.** Vocabulary: German→English, English→German, multiple choice,
article, sentence context, sentence reading, word recognition. Grammar: fill in
the blank, multiple choice, transformation, sentence reconstruction, error
correction, context selection. Plural-form and verb-table exercises are
deliberately disabled because the underlying fields are absent from the current
source data; they self-enable per word when `pluralForm` or `verbForms` is
populated. Dictation and pronunciation depend on browser speech APIs and hide
themselves when unavailable.

**Answer checking** is lenient: case, punctuation, ß/ss and whitespace are
ignored, multiple accepted answers are supported, and a near miss is reported as
"almost".

**Spaced repetition** is FSRS-5, reimplemented in `src/srs.js` with the
published default parameters (no npm dependency, because the app has no build
step). The learner never self-rates; the grade is inferred from the answer
(wrong → Again, one-typo near miss → Hard, correct → Good, correct production by
typing or speech without a hint → Easy). Records written by the earlier SM-2
scheduler are migrated non-destructively on read.

**Persistence** is `localStorage`, but the schema is keyed by `userId` across
five collections (`profile`, `vocabProgress`, `grammarProgress`, `sessions`,
`events`) so the adapter can be replaced by a server without touching call
sites. This is the single most important existing decision for the planned
accounts/cloud-sync work.

**Single-file build.** `app/tools/build_artifact.py` inlines CSS, modules, both
databases and the image into `dist/master-fuka-german.html`, which runs with no
server and no network.

---

## 3. Architecture

```
PDF / list sources (not committed)
        │  extract_pdf.py, extract_c1_grammar.py, extract_daf_grammar.py,
        │  extract_web_grammar.py, build_cefr.py, build_frequency.py
        ▼
app/tools/*.json + app/tools/annotations/*.tsv|*.json   (committed, reviewable)
        │  build_vocabulary.py, build_grammar.py
        ▼
app/data/*.json
        │  validate_content.py
        ▼
Browser: ES modules loaded over HTTP, localStorage for learner state
```

Key properties, as documented in `app/README.md`:

* No build step for the app itself; no runtime dependencies; no server.
* The grammar build refuses to produce output unless every example sentence
  occurs verbatim in its own topic's source text; content authored for practice
  is flagged `fromSource: false`.
* The CEFR build cross-checks a third-party transcription against the official
  PDF text and refuses to build below a 75 % verification rate.
* A word takes the **lowest** level any source assigns it.
* Source PDFs are not committed — only extracted structured data.

### Runtime and tooling requirements

* A browser with ES module support (the app must be served over HTTP; `file://`
  does not work).
* Python 3 for the content pipeline. `python3 -m http.server` is sufficient to
  serve the app.

### Documented local start

```bash
python3 -m http.server 8000     # from the repository root
# then open http://localhost:8000/app/
```

### Documented validation command

```bash
python3 app/tools/validate_content.py
```

`app/README.md` records its expected output as: `vocabulary: 4768 words
checked`, `grammar: 121 topics, 615 exercises checked`, `PASSED — 0 errors,
1 warning`, the warning being a genuine duplicate gloss in the OCR source that
is intentionally left standing. **This document does not confirm that output —
the command was not run in this pass.**

---

## 4. Known limitations

1. **No automated test suite.** `validate_content.py` checks *content* only.
   There are no unit tests for `srs.js`, `exercises.js`, `lessons.js`,
   `coach.js` or `db.js`, and no browser/end-to-end tests. Nothing in CI runs
   either.
2. **Local-only progress.** All learner state lives in `localStorage`: it is
   per-browser, per-device, lost when site data is cleared, and there is no
   export, import or sync.
3. **No accounts, no backend.** Not started.
4. **Single UI language.** The interface is English-for-German-learners; there
   is no i18n layer, so adding a second interface language today means touching
   view code.
5. **Web only.** No Android or iOS packaging, no PWA manifest or service worker
   in the file tree, so no offline install path other than the single-file
   artifact.
6. **Level coverage is uneven and must not be overstated.** Grammar exists for
   A1, A2, B1 and C1; **B2 and C2 grammar are empty**. Vocabulary is levelled
   A1–B2, with B2 resting on a single source. Some cards carry only an
   *approximate* CEFR mapping derived from a GCSE Foundation/Higher tier. The
   project must not claim CEFR completeness.
7. **Frequency data is surface-form only.** 785 of 2 047 OCR cards carry a rank;
   no lemma matching; case-folded counts are flagged `frequencyShared`. Ranks
   come from a film/TV subtitle corpus and must be labelled as such.
8. **Speech features are browser-dependent.** Speech recognition is effectively
   Chromium-only and needs microphone permission; a genuine German TTS voice is
   common but not guaranteed.
9. **Rebuilding content is not reproducible from the repository alone.** The
   extractors require source PDFs and lists that are deliberately not committed
   and, in at least one documented case, were fetched from a host blocked by the
   original environment.
10. **Large committed JSON.** ~6 MB of generated data in git; every rebuild
    produces a large diff, and the browser loads multi-megabyte files on start.
    No lazy loading or chunking is described.
11. **The AI Learning Coach is not AI.** It is deterministic and data-driven.
    This is a correct and honest design for a static app, but it means the
    planned AI Coach is entirely unbuilt.
12. **Documentation is split across two languages** (Czech root README and
    `COLLABORATION.md`, English `app/README.md`), and the root README does not
    mention the validation command or the single-file build.
13. **`app/README.md` refers to Netlify publishing the repository root**, but no
    Netlify configuration file is present in the tree — the deployment setup is
    either external to the repository or stale. Not changed in this pass.

---

## 5. External credentials and assets required

None are required to run the app as it exists today — it has no network calls,
no API keys and no accounts.

Required for planned work, and **not present in the repository** (and never to
be committed, per `CLAUDE.md` and `COLLABORATION.md`):

| Need | Purpose | Status |
|---|---|---|
| Backend/auth provider credentials | Accounts, cloud sync | Not chosen, not provisioned |
| AI provider API key | AI Learning Coach | Not chosen; must be server-side, never in client code |
| Apple Developer account / Google Play account | iOS and Android release | Not provisioned |
| Hosting/deploy tokens | Web deployment (Netlify or successor) | Not visible in the repository |
| Source documents for content rebuilds | Re-running the extractors | Not committed by design; must be supplied per build |

Any of these must be supplied through repository/organisation secrets or a local
`.env` that is never committed.

---

## 6. Release blockers

Blocking a credible public release, roughly in order:

1. No automated test coverage of the learning engine, and no CI running any
   check on pull requests.
2. Progress can be lost silently (single-browser `localStorage`, no export).
3. No accounts or sync, so a learner cannot move between devices.
4. No mobile packaging or offline-install path.
5. Content-coverage claims must be audited against the data before any store
   listing or marketing copy — B2/C2 grammar is absent and some levels are
   approximations.
6. Source attribution and licence terms must be re-checked per source before
   distribution; at least one source is CC BY-NC (non-commercial), which
   directly constrains a paid/premium tier.
7. No privacy policy, terms, or data-handling statement — mandatory for app
   stores and for anything that stores user data server-side.
8. No free/premium boundary exists in the code.
9. Startup cost of multi-megabyte JSON on mobile networks is unmeasured.

---

## 7. Phased roadmap

Deliberately short, and limited to what the current codebase supports. No dates.

**Phase 1B — verify the audit.** Run `python3 app/tools/validate_content.py` and
record the exact output; smoke-test the documented local start path; confirm the
content counts quoted above; fix clear defects found. Correct any documentation
inconsistency the run exposes (including items 12 and 13 above).

**Phase 2 — testing and CI.** Add a minimal test runner and unit tests for
`srs.js` (FSRS behaviour and SM-2 migration), `exercises.js` (answer checking and
availability) and `db.js` (schema, migration). Add a CI workflow that runs the
tests and `validate_content.py` on every pull request. No framework rewrite.

**Phase 3 — durable learner data.** Introduce progress export/import, then
define the storage adapter boundary explicitly so `localStorage` and a future
remote store are interchangeable. No backend yet.

**Phase 4 — mobile readiness.** PWA manifest, service worker, offline caching,
data-loading cost measured and reduced if needed. Then evaluate a wrapper
(Capacitor or equivalent) for store distribution.

**Phase 5 — accounts and sync.** Choose a provider, implement server-side auth
and sync behind the Phase 3 adapter, add the privacy policy and data-handling
documentation. Requires credentials listed in section 5.

**Phase 6 — multi-language interface.** Extract UI strings behind an i18n layer;
add a second interface language as the proof.

**Phase 7 — AI Learning Coach.** Keep the deterministic coach as the fallback
and the source of ground truth. Any model call goes through a server-side
endpoint with the key held server-side, is grounded in the learner's records,
and must never be able to assert progress the database does not show.

**Phase 8 — content depth and premium structure.** Fill documented gaps (B2
grammar first), re-verify licences per source, then design the free/premium
split around what the licences actually permit.

---

## 8. Open decisions for the maintainer

* Backend and auth provider (Phase 5) — affects Phase 3's adapter design.
* Whether a premium tier is compatible with the CC BY-NC content currently in
  the grammar database, or whether that content must be replaced first.
* Documentation language policy: keep Czech root docs with an English app, or
  unify.
* Whether generated JSON should stay in git or move to a build artifact.
