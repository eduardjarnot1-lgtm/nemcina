# Testing

How to check this app before a change is merged. It is a static page with no
build step, so there is no test runner to install and nothing to compile.

Two kinds of check exist here, and they are kept apart on purpose:

| | What it is | Who runs it |
|---|---|---|
| **Automated** | `app/tools/validate_content.py` — content validation only | a command, reproducible |
| **Manual** | the browser smoke test below | a person, in a real browser |

There is no automated test coverage of the app's JavaScript. `PROJECT_STATUS.md`
records this as known limitation 1: no unit tests for `srs.js`, `exercises.js`,
`lessons.js`, `coach.js` or `db.js`, no browser or end-to-end tests, and nothing
running either in CI. A minimal test runner and unit tests are Phase 2 of the
roadmap in that document. Until then, everything in the manual section is the
only coverage the learning engine has.

---

## 1. Automated check — content validation

Run from the repository root:

```bash
python3 app/tools/validate_content.py
```

It validates the two built databases, `app/data/vocabulary.json` and
`app/data/grammar.json`: duplicate ids, duplicate and near-duplicate entries,
missing German words and translations, malformed articles and plurals, invalid
levels, CEFR level/source agreement, frequency rank consistency, missing source
attribution, malformed grammar topics, and unknown or circular prerequisites.

It exits `0` when there are no errors and `1` when there are, so it can gate a
build (`app/tools/validate_content.py:242-256`). **Warnings do not fail the
run** — only errors do.

### Latest verified result

Taken verbatim from `PROJECT_STATUS.md` section 3, which records the run:

> **Result: PASSED — 0 errors, 1 warning. 98 776 checks run.** Exit status 0.
> Environment: Python 3.12.3 on Linux, run 2026-09-14 in CI.

```
vocabulary: 4768 words checked
grammar: 121 topics, 615 exercises checked

98776 checks run
  warning: vocabulary: near-duplicate variants for 'einwerfen': w0788 'to post' / w0938 'to post (a letter)'
PASSED — 0 errors, 1 warning(s)
```

The single warning is expected and is left standing deliberately: the OCR source
prints *einwerfen — to post* in the Foundation tier and *einwerfen — to post (a
letter)* in the Higher tier, so both cards are kept and flagged for a human
(`app/README.md`, "Data integrity").

**Treat that output as the baseline.** A run on unchanged data should reproduce
it exactly. Any new error, any new warning, or a change in the checked counts
means the change under review altered the content — investigate before merging.

### When to run it

Whenever anything under `app/data/`, `app/tools/` or `app/tools/annotations/`
changes. Purely front-end changes (`app/src/`, `styles.css`, `index.html`)
cannot affect it, but running it costs seconds and proves the data is untouched.

If a build script was re-run, run the rest of the pipeline first, in the order
`app/README.md` documents, and validate last.

---

## 2. Manual browser smoke test

Nothing below is automated. Each box is a human action in a real browser.

### Serve the app

```bash
python3 -m http.server 8000     # from the repository root
# then open http://localhost:8000/app/
```

The app **must** be served over HTTP. Opening `index.html` from `file://` does
not work: it loads ES modules and `fetch`es the JSON databases.

### Start page and navigation

- [ ] The page loads without the "Loading the vocabulary…" placeholder
      persisting, and the browser console shows no errors.
- [ ] The German Learning hub renders: the coach, the sections, the target
      level.
- [ ] Every top-bar link reaches its screen — Vocabulary, Core, Grammar, Review,
      Progress, Data.
- [ ] Search in the top bar returns German words, English glosses and grammar
      topics.
- [ ] Browser Back and Forward move between screens (routing is hash-based), and
      pasting a deep link such as `#/progress` opens that screen directly.

### Vocabulary practice

- [ ] A topic → sub-topic → word type path reaches a set of cards, and a card
      shows the article, meaning, example sentence and English translation.
- [ ] Start a practice run and answer several questions. Both a correct and a
      deliberately wrong answer are handled, and each is followed by feedback.
- [ ] A near miss — one typo, e.g. `Hause` for `Haus` — is reported as "almost"
      rather than simply wrong.
- [ ] Lenient checking holds: wrong case, trailing punctuation and `ss` for `ß`
      are accepted.
- [ ] Plural-form and verb-table questions never appear. They are switched off
      because the source data does not carry those fields.
- [ ] Speaker buttons appear only if the browser has speech synthesis; where
      they appear, they speak. Dictation and pronunciation questions are offered
      only for a word already answered correctly at least once, and speech
      recognition is Chromium-only and needs microphone permission. Refusing the
      microphone must report a reason and leave the question unanswered — not
      mark it wrong.

### Grammar exercise

- [ ] Grammar lists 121 topics grouped by level and then by the source's own
      section, and the level rail moves between levels.
- [ ] A topic page shows the English summary, the rules, the source's examples
      and its exercises.
- [ ] Practise a topic. Check one of each exercise type the topic offers — fill
      in the blank, multiple choice, transformation, sentence reconstruction,
      error correction, context selection.
- [ ] In a sentence-reconstruction (reorder) question, tokens can be added and
      the assembled line updates.
- [ ] A multiple-choice question offers at least three distinct options and its
      answer is among them.
- [ ] After answering, the explanation and the source credit for the topic are
      shown.

### Progress persistence

- [ ] After a practice run, Progress shows the session: per topic, per grammar
      unit, streak, XP, weak words, recent mistakes, recent sessions.
- [ ] Reload the page. The same progress is still there.
- [ ] State survives a browser restart. It lives in `localStorage` under
      `fuka-german-db-v1:<collection>` (`profile`, `vocabProgress`,
      `grammarProgress`, `sessions`, `events`).
- [ ] The Review screen offers cards the spaced-repetition schedule says are
      due, and is empty rather than broken when nothing is due.
- [ ] In a private/incognito window, where storage may be unavailable, the app
      still works for the session instead of failing — progress is simply not
      persisted.
- [ ] Reset progress does what it says, and the screens return to their empty
      state afterwards.
- [ ] Progress is per-browser and per-device by design. There is no sync and no
      export, so "it is missing in another browser" is expected behaviour, not a
      defect (`PROJECT_STATUS.md`, limitation 2).

**Known trap:** clearing site data to re-test a first-run path destroys the
progress you just created. Use a separate browser profile if you want to keep
it.

### Keyboard

- [ ] Tab from the top of the page reaches the "Skip to content" link first, and
      activating it moves focus to `<main>`.
- [ ] Tab order through the top bar is sensible and the focused element is
      always visibly focused.
- [ ] In a typed-answer question, Enter submits the answer — no mouse needed.
- [ ] Enter in the search box opens the search results screen.
- [ ] A full practice run can be completed using the keyboard alone.

### Mobile and narrow viewports

- [ ] At a phone width (≈360–560 px) nothing overflows horizontally and no text
      is clipped. The stylesheet has breakpoints at `max-width: 560px` and
      `min-width: 640px`.
- [ ] Buttons and answer options are large enough to tap accurately.
- [ ] The top bar and the search box remain usable at that width.
- [ ] The on-screen keyboard does not cover the answer field while typing.
- [ ] Note the first-load feel on a throttled connection. The databases are
      several megabytes; `PROJECT_STATUS.md` limitation 9 records that this cost
      is unmeasured, so a slow start is a known gap rather than a surprise.

### Accessibility

These are spot checks, not a conformance audit. No formal accessibility audit
has been done on this app.

- [ ] Dark mode renders correctly. The page declares `color-scheme: light dark`
      and the stylesheet has a `prefers-color-scheme: dark` block; switch the OS
      or browser setting and check contrast in both.
- [ ] With "reduce motion" enabled at OS level, animation is suppressed — the
      stylesheet has a `prefers-reduced-motion: reduce` block.
- [ ] Zoom to 200 %. The layout stays usable.
- [ ] With a screen reader, the answer input announces its label, and the
      breadcrumb marks the current page.
- [ ] Live regions announce what they should: the assembled reorder line and the
      speech state both update politely rather than silently.
- [ ] Progress rings are announced as their labelled summary ("N of M words
      learned") and the decorative ring SVGs are skipped.
- [ ] Speaker buttons announce what they will say rather than reading as a bare
      emoji.

---

## 3. What this task did not do

This guide was written from the repository as it stands. **No browser test was
run by the task that added this file.** Every box in section 2 is unticked
because nobody has ticked it — the checklist is a procedure, not a record of a
passing run.

The content-validation command in section 1 *was* run, to confirm the baseline
quoted there still reproduces on the current data. It did, byte for byte. That
run is not recorded in `PROJECT_STATUS.md`, which this task does not change; the
verified result of record remains the 2026-09-14 CI run documented there.

## 4. Recording a run

When you do work through the checklist, say so in the pull request: the browser
and version, the OS, the viewport you checked, which boxes passed, and which
were skipped and why. A skipped box is fine; an unstated skip is not.

Do not record a check as passed unless it was actually performed. The value of
this file is that its claims can be trusted.
