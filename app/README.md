# Master Fuka — German Learning (beta)

A learning app built on three imported source documents plus a word-frequency
list. It is not a PDF reader:
the documents are extracted, normalised, validated and turned into vocabulary
cards, grammar units, exercises, spaced review and progress tracking.

Open `app/index.html` through a web server (ES modules and `fetch` do not
work over `file://`):

```bash
python3 -m http.server 8000     # from the repository root
# then open http://localhost:8000/app/
```

On Netlify the site publishes the repository root, so the app is served at
`/app/`.

## Sources

The vocabulary was rebuilt from scratch. It used to be an exam board's list
levelled against publishers' word lists and glossed from a dictionary — all
accurate, all carefully attributed, and none of it ours, which made vocabulary
the project's first release blocker. Every word in the app is now from a list
composed for it.

| Content | Source | Status |
|---|---|---|
| Vocabulary — 2 758 cards | Four lists composed for this project: A1 (600), A2 (900), B1 (1 000), B2 (500) | imported |
| Grammar — 15 B2 topics | *Deutsche Grammatik – Niveau B2*, parts 1–2, composed for this project | imported |
| Grammar — 87 A1/A2/B1 topics | DaF kompakt neu A1/A2/B1, Grammatikerklärungen, © Ernst Klett Sprachen GmbH, Stuttgart 2018 | imported |
| Grammar — 32 C1 topics | Sicher! C1 Grammatikübersicht, © Hueber Verlag | imported |
| B1 grammar gaps | deutsch-lernen-goethe-a1-c2, Abdullah Butt (CC BY-NC 4.0) | imported |
| Word frequency — 2 586 forms | hermitdave/FrequencyWords, German (OpenSubtitles corpus) | imported |

The grammar is still 121 topics of Klett and Hueber. **That is now the only
licensing blocker left**, and `app/ZDROJE.md` says so plainly.

## The vocabulary rebuild

Four lists, each printing a headword, its article, an English gloss, an example
sentence and that sentence's translation — so nothing has to be borrowed from a
dictionary and nothing is inferred.

```
A1   600 entries, 12 topics        B1  1 000 entries, 18 topics
A2   900 entries, 15 topics        B2    500 entries, 25 topics
                                   ----------------------------
3 000 entries in -> 2 758 cards    A1 600 · A2 854 · B1 983 · B2 321
```

`extract_clean_vocabulary.py` reads them. Three arrived as PDFs in the same
generated layout the B2 list uses, so the parse keys on the font rather than on
column positions: every cell is its own text run, a wrapped cell is two runs in
one font, and consecutive runs of a font are one cell. The fourth arrived as
JSON and is read and checked the same way, so the build sees one kind of source.

### The Czech headings arrived damaged, and are repaired explicitly

The A1 and A2 PDFs were written with a WinAnsi font, which has no ř, č or ě.
Those characters were dropped and ReportLab substituted a ZapfDingbats box, so
`Počasí` extracts as `Po`, a box, and `así`. The German and English entry data
is untouched — only the Czech headings.

Two things make that safe to repair rather than guess at. Each heading is
`Czech — English` and **the English half is undamaged**, so every repair is
checked against a label the document still states. And the repairs are an
explicit table in the extractor, not a rule: a damaged heading it has no entry
for stops the extraction rather than reaching a learner mangled.

### The rules that survived the rebuild

They were never about the old sources:

* A word sits at the **lowest** level any list assigns it. 207 entries repeat a
  word an earlier list already taught; they add their topic to the existing card
  rather than making a second one.
* A further 35 repeat a word with slightly different wording — `to reconcile /
  make up` at B1 against `to reconcile` at B2. Those merge too, keeping the
  gloss that names more senses. A shared sense is required, and so are the
  article and the part of speech.
* The same headword with a **different** meaning is a homonym and keeps its own
  card. `der Morgen` and `morgen` are not one word, and neither are `die Orange`
  and `orange` — different article, different word class, different meaning.
  German capitalisation is part of the word, so the merge key never folds case.
* Nothing is invented. A part of speech is used where a list states one, and
  derived only from what the entry prints otherwise: an article makes a noun,
  three B2 headings name a word class for their entries, and a gloss beginning
  `to ` is the list calling the entry a verb. Everything else stays
  unclassified rather than guessed at.

### What this bought

The content gate now passes with **0 errors and 0 warnings** — the first time
it has. The one long-standing warning was *einwerfen*, printed twice with
different glosses in the GCSE list, which is gone. `validate_content.py` also
gained the check that keeps the rebuild true: a card carrying a third-party
translation source fails the build.

## What the app does

* **German Learning hub** — the coach, the four sections, the target level.
* **Vocabulary** — the document's own topics → sub-topics → word type → cards
  with article, meaning, example sentence and English translation.
* **Grammar** — 121 topics from A1 to C1, grouped by level and then by the
  source's own section (DaF kompakt's Roman-numbered chapters, Sicher!'s
  Lektionen), each with an English summary, the rules, the source's own
  examples, and 4–7 exercises.
* **Lessons** — a personalised mix of new words, weak words, overdue reviews
  and one grammar exercise, composed from your own records.
* **Review** — everything the spaced-repetition schedule says is due.
* **Progress** — per topic, per grammar unit, streak, XP, weak words, recent
  mistakes, recent sessions.
* **Core words** — the cards that carry a subtitle-frequency rank, most
  frequent first, with their learning status.
* **Search** — German, English and grammar topics in one box.
* **Learning Coach** — recommendations computed from the database.

### Exercise types

Vocabulary: German→English, English→German, multiple choice, article
(`der/die/das`), sentence context (the word blanked out of its own example),
sentence reading, word recognition.
Grammar: fill in the blank, multiple choice, transformation, sentence
reconstruction, error correction, context selection.

Two types are deliberately **switched off**: plural forms and verb tables. The
OCR list prints neither, so `exercises.js#availability()` reports them as
unavailable rather than generating questions from data that does not exist.
They turn themselves on for any word that arrives with `pluralForm` or
`verbForms` populated — which the Goethe list would supply.

Two further types depend on the browser rather than on the data: **dictation**
(hear the word, type it) needs speech synthesis, and **pronunciation** (say the
word, the browser transcribes it) needs speech recognition. Both are offered
only once a word has been answered correctly at least once — hearing a word you
have never seen written is a spelling test, not a memory test — and both hide
themselves entirely where the browser cannot do the job.

Typed answers are checked leniently: case, punctuation, ß/ss and whitespace are
ignored, several answers can be accepted, and a near miss is reported as
"almost" rather than wrong.

## Spaced repetition: FSRS

The scheduler is **FSRS-5**, implemented in `src/srs.js` with the published
default parameters. Each card carries a *stability* (days until recall
probability falls to 90 %) and a *difficulty* (1–10); retrievability is computed
from how long ago the card was last seen rather than stored, so a card left for
a month is treated as shakier than the same card seen yesterday. That is the
reason for the change: the SM-2 scheduler this replaces multiplied a fixed
interval and had no notion of how faded a memory was when you came back to it.

It is reimplemented rather than installed. `ts-fsrs` is a TypeScript npm
package and this app has no build step, so vendoring it was not an option;
the algorithm is published and short.

The learner is never asked to rate their own recall, so the grade is inferred
from the answer:

| Answer | Grade |
|---|---|
| wrong | 1 — Again |
| a near miss, one typo by edit distance | 2 — Hard |
| correct | 3 — Good |
| correct, German produced by typing or speaking, no hint on screen | 4 — Easy |

The minutes right after a lapse are handled by fixed learning steps rather than
by the model, the same separation Anki uses. A word is called "learned" when
the scheduler itself is willing to leave it alone for a week, not when a
counter reaches two.

Records written by the old SM-2 scheduler are migrated on read, non-destructively:
the old difficulty is rescaled onto FSRS's 1–10 and the interval the old
scheduler had arrived at becomes the starting stability.

## Word frequency

`tools/build_frequency.py` turns the raw `<form> <count>` list into
`data/frequency.json`, and `build_vocabulary.py` stamps a `frequencyRank` onto
every card whose **printed headword is itself a listed form**. 496 of the
2 758 cards match.

No lemma matching is attempted. The corpus lists surface forms, so `ist` and
`sind` are separate entries and neither resolves to `sein`; attaching `sein`'s
card to their counts would put a number on a card the corpus never measured.
The remaining listed forms are function words and inflections the vocabulary
lists do not carry as headwords.

The corpus is also case-folded, so where two cards share a spelling —
*morgen*/*Morgen*, *wagen*/*Wagen*, *Paar*/*paar* — the count covers both. Those
cards are flagged `frequencyShared` and say so on screen rather than claiming
the rank outright. The validator enforces the invariant that a shared rank only
ever belongs to cards with the same headword.

Ranks are used in three places: to order new words in a lesson (frequent words
taught first, unranked words last within their tier rather than excluded), to
label cards, and to build the Core words screen. Every display says the ranking
comes from film and television subtitles, because "#312" alone would read as a
claim about German in general.

## Audio

`src/audio.js` wraps two browser APIs. The research brief proposed Piper for
speech and Whisper for recognition; both want tens of megabytes of model
weights and a process to run them in, which a static page does not have.

| | Used | Availability |
|---|---|---|
| Text to speech | `speechSynthesis`, `de-DE` | Engine almost everywhere; a genuine German voice is common but not guaranteed |
| Speech to text | `SpeechRecognition` / `webkitSpeechRecognition`, `de-DE` | Chromium browsers, and only with microphone permission |

Speaker buttons render only where the engine exists, so there is never a button
that does nothing, and `listenOnce()` always resolves — never rejects — with
either a transcript or a named reason, so a refused microphone reports itself in
the panel and leaves the question unanswered instead of marking it wrong.

## Data integrity

`build_grammar.py` refuses to build unless **every example sentence occurs
verbatim in the source text of its own topic** (whitespace-normalised, footnote
markers removed). Exercises that use a source sentence are checked the same
way; anything written for practice is marked `fromSource: false`. The same rule
caught two mistakes while this was being written — a phrase that was not in the
document and a sentence with a footnote marker — which is exactly what it is
for.

`validate_content.py` runs 98 000+ checks over both databases: duplicate ids,
duplicate entries, near-duplicate variants, missing German words, malformed
articles and plurals, invalid levels, missing source attribution, malformed
grammar topics, unknown or circular prerequisites.

```bash
python3 app/tools/validate_content.py
# vocabulary: 2758 words checked
# grammar: 121 topics, 615 exercises checked
# PASSED — 0 errors, 0 warnings
```

The one warning is genuine and left standing: the OCR list prints *einwerfen —
to post* in the Foundation tier and *einwerfen — to post (a letter)* in the
Higher tier, so both are kept and flagged for a human.

### Levels

The app has A1–C2 as structure. It does **not** claim to hold an A1–C2
curriculum.

A1, A2, B1, B2 and C1 hold grammar, and those labels are the documents' own:
DaF kompakt prints `(A1)`, `(A2)` or `(B1)` beside every block and the extractor
reads the level off the heading; Sicher! is C1 throughout; the B2 set states B2
in its own title. C2 is empty and says so.

Every vocabulary card states its level too, because each list says which level
it is. Nothing is approximated any more — the `cefrApprox` fallback existed for
the GCSE list, which graded by Foundation/Higher tier and stated no CEFR level
at all, and a core test now asserts that no card falls back to it.

## The pipeline

```
Sicher_C1_...pdf   DaF_kompakt_...pdf   German_Grammar_B2_1+2.pdf
  │ extract_c1_       │ extract_daf_        │ extract_b2_grammar.py
  │   grammar.py      │   grammar.py        ▼
  ▼                   ▼                   tools/b2-grammar-source.json
tools/c1-source.json  tools/daf-source.json   15 topics
  │                   │                     │
  │  tools/annotations/grammar/*.json        │
  │    summary, rules, examples, exercises   │
  ▼ tools/build_grammar.py ◄─────────────────┘
data/grammar.json

German_Vocabulary_A1_600.pdf   A2_900.pdf   B1_1000.json   B2.pdf
  │                              │            │              │
  └──── tools/extract_clean_vocabulary.py ────┘              │ extract_b2_
             │  --pdf / --json, per level                    │  vocabulary.py
             ▼                                               ▼
  tools/clean-a1-source.json  clean-a2-…  clean-b1-…   b2-vocabulary-source.json
             └──────────────┬──────────────────────────────┘
                            ▼ tools/build_vocabulary.py
                       data/vocabulary.json
        └──────────────────────┬─────────────────────────┘
                               ▼  tools/validate_content.py
                          the learning engine
```

`build_grammar.py` is source-agnostic: each document is one entry in its
`SOURCES` table, saying where its level comes from (Sicher! is C1 throughout;
DaF kompakt prints a level per block) and how its topics are grouped for
display. Adding a fourth document means writing an extractor and one table
entry, not touching the app.

Rebuild everything:

```bash
# grammar
python3 app/tools/extract_c1_grammar.py <Sicher_C1_Grammatikuebersicht.pdf>
python3 app/tools/extract_daf_grammar.py <DaF_kompakt_neu_A1_A2_B1_Grammar_English.pdf>
python3 app/tools/extract_b2_grammar.py \
  --pdf <German_Grammar_B2_1.pdf> --pdf <German_Grammar_B2_2.pdf> --expect 15
python3 app/tools/build_grammar.py

# vocabulary
python3 app/tools/extract_clean_vocabulary.py \
  --pdf <German_Vocabulary_A1_600.pdf> --level A1 --expect 600 \
  --out app/tools/clean-a1-source.json
python3 app/tools/extract_clean_vocabulary.py \
  --pdf <German_Vocabulary_A2_900.pdf> --level A2 --expect 900 \
  --out app/tools/clean-a2-source.json
python3 app/tools/extract_clean_vocabulary.py \
  --json <German_Vocabulary_B1_1000.json> --level B1 --expect 1000 \
  --out app/tools/clean-b1-source.json
python3 app/tools/extract_b2_vocabulary.py --pdf <German_Vocabulary_B2.pdf>
python3 app/tools/build_frequency.py <de_top2000_frequency.txt>
python3 app/tools/build_vocabulary.py

python3 app/tools/validate_content.py
python3 app/tools/build_artifact.py          # single-file bundle
```

Both builds fail loudly rather than silently dropping content: the vocabulary
extractors refuse to write unless every entry parses and the totals match
`--expect`; the grammar build fails on an ungrounded example, a missing answer, a choice
whose answer is not among its options, or an unannotated topic.

Source PDFs are not committed — only the extracted structured data, so the
imported text stays limited to what the app needs and is traceable to a page
number.

## Code layout

```
app/
  index.html            shell: top bar, search, main region
  styles.css            light + dark theme, no framework
  data/vocabulary.json  4646 cards, levelled A1–B2
  data/cefr.json        4442 levelled headwords with their sources
  data/frequency.json   2586 ranked word forms
  data/grammar.json     121 topics, 615 examples, 615 exercises
  src/
    data.js         vocabulary loading + indexing
    grammar.js      grammar loading + indexing (by level, group, category)
    db.js           the learner database: profile, progress, sessions, events
    srs.js          spaced repetition (FSRS-5) — pure functions
    audio.js        speech synthesis + speech recognition, both optional
    progress.js     vocabulary status façade over db.js
    exercises.js    exercise generation + lenient answer checking
    lessons.js      the personalised lesson engine
    coach.js        the Learning Coach — reads records, invents nothing
    runner.js       one state machine for every activity
    search.js       German/English search
    fuka.js         Master Fuka's lines
    ui.js           rings, circles, cards, breadcrumbs
    views.js        vocabulary screens
    learnViews.js   hub, progress, grammar screens
    app.js          hash router + event wiring
  tools/            the pipeline above
```

### The database

There is no server and no account system, so the store is `localStorage` — but
the *schema* is the real one, keyed by user id, so the adapter can be swapped
for a server without touching a call site:

| Collection | Fields |
|---|---|
| `profile` | userId, displayName, targetLevel, createdAt, streakDays, lastActiveDay, xp |
| `vocabProgress` | userId, vocabularyItemId, status, seen, correctCount, incorrectCount, repetitionCount, lastSeen, nextReview, difficulty, stability |
| `grammarProgress` | userId, grammarTopicId, completion, correctCount, incorrectCount, masteryScore, lastPracticed, nextReview |
| `sessions` | id, userId, startedAt, finishedAt, kind, items, correct, total |
| `events` | id, userId, at, kind, itemId, itemKind, correct, given, expected |

Progress saved by the previous version of the app is migrated on first load,
non-destructively, and given a real place in the review schedule.

### The Learning Coach

Deterministic and data-driven. The app is a static page with no server, so
there is no language model at runtime; the coach computes every statement from
the records above and names the numbers behind it ("you have answered 3 of 8
questions on this topic correctly"). It never asserts progress the database
does not show, and when there is nothing recorded it says so.

## Single-file build

`python3 app/tools/build_artifact.py` inlines the CSS, the modules, both
databases and Master Fuka's picture into `dist/master-fuka-german.html` — one
file that runs with no server and no network. Edit the sources, never the
bundle. The modules are flattened into one scope, so the bundler rejects
aliased imports (`x as y`) that cannot survive flattening.

## The two B1 grammar gaps are closed

When DaF kompakt was imported, two of the five B1 areas asked for were not in
that document and nothing was written to cover them. Both are now imported from
published material rather than authored here:

* **Zustandspassiv** — the sein-passive against the werden-passive, from the
  `deutsch-lernen-goethe-a1-c2` grammar sheets (Abdullah Butt, CC BY-NC 4.0).
  The licence is non-commercial, which suits this app and is carried in the
  credit line shown with the topic.
* **Verbs with a fixed preposition** — from the same project's exercise set plus
  the 66 entries in the Lingster list that print a verb with the preposition and
  case it governs (`warten auf A`, `träumen von D`).

`extract_web_grammar.py` writes the raw source text for both, so the same
grounding rule applies to them as to everything else: an example not present in
the source does not build.

That rule earned its keep again here. The Lingster list prints **`glauben an D`**,
which is wrong — `glauben an` takes the accusative (*Ich glaube an dich*). The
build rejected the corrected version because it was not in the source, so the
topic now quotes the list exactly as printed and carries an explicit warning
that the entry is an error. It is neither silently corrected nor silently
taught.

## What was proposed but not integrated

The **Tatoeba `deu-eng`** sentence pairs (~330 000 pairs, which would give
generated example sentences and cloze exercises) are still not here — the file
was never supplied and no reachable copy was found. The FreeDict `deu-eng`
dictionary is no longer needed: the Ding dictionary now fills that role.

Source documents are not committed — only the extracted structured data. The
build commands above name the files they expect.
