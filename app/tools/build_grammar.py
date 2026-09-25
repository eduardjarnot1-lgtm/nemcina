#!/usr/bin/env python3
"""Build german/data/grammar.json from the extracted grammar topics + annotations.

Pipeline
--------
1. The extractors read their PDFs and write one source file each:
     extract_c1_grammar.py  -> c1-source.json   (Sicher! C1, 32 topics)
     extract_daf_grammar.py -> daf-source.json  (DaF kompakt neu, 87 topics)
   Each record carries the raw source text of its topic.
2. ``annotations/grammar/*.json`` add, per topic, an English summary, the
   rules, the examples to show and the exercises to generate.
3. This script validates that authored content is actually grounded in the
   document and emits the runtime database.

The validation is the point of this step. Every example sentence, and every
exercise sentence marked ``"source": true``, must occur verbatim (whitespace
normalised) in the source text of its own topic. An exercise the author wrote
from scratch must say so with ``"source": false``, and is then labelled as a
practice item in the app rather than passed off as document content.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANNOTATIONS = ROOT / "annotations" / "grammar"
TABLES_FILE = "tables.json"
COMPARISONS_FILE = "comparisons.json"
WORDORDER_FILE = "wordorder.json"
TRANSLATIONS_FILE = "translations.json"
FORMULAS_FILE = "formulas.json"

# The word classes a mark may name. Closed classes only: a conjunction, a
# preposition and a question word can be recognised from a finite list, and a
# verb form in these examples was identified by hand. Nothing here is guessed at
# build time — an unknown role stops the build rather than rendering as neutral,
# because a silently dropped role is a highlight that teaches less than it says.
MARK_ROLES = {"conj", "verb", "prep", "q"}

# Exercise types whose answer is a *form* rather than a whole sentence. A
# reorder answer is the sentence itself and says nothing about which word the
# topic is teaching, so it is not a signal.
FORM_EXERCISES = {"choice", "fill", "transform", "error", "context"}

# A handful of the corpus's "examples" are English notes stored in the German
# field, and a few exercise answers are English words. Highlighting "the" or
# "preterite" inside them would mark a word that is not a German form at all.
# This is a blocklist of English function words rather than a language detector:
# it is small, it is checkable, and it cannot accidentally reject a German form.
NOT_A_FORM = {
    "the", "and", "for", "use", "instead", "of", "with", "but", "not", "to",
    "is", "are", "was", "were", "preterite", "perfect", "present", "past",
    "this", "that", "they", "you", "verb", "noun", "form", "case", "or",
}
OUT = ROOT.parent / "data" / "grammar.json"

# Each source names itself, says where its level comes from, and says how its
# topics are grouped for display.
SOURCES = {
    "sicher-c1": {
        "file": "c1-source.json",
        "title": "Sicher! C1 Grammatikübersicht",
        "credit": ("Erweiterte Darstellung der Grammatikseiten zu Sicher! C1 Kursbuch, "
                   "© Hueber Verlag; Autorinnen: Michaela Perlmann-Balme, Susanne Schwalb, "
                   "Magdalena Matussek."),
        "level": "C1",              # one level for the whole document
        "group": lambda t: f"Lektion {t['lektion']}",
        "groupOrder": lambda t: t["lektion"],
        "order": lambda t: t["number"],
    },
    "daf-kompakt": {
        "file": "daf-source.json",
        "title": "DaF kompakt neu A1–B1 — Grammar explanations",
        "credit": ("DaF kompakt neu A1/A2/B1, Grammatikerklärungen, "
                   "© Ernst Klett Sprachen GmbH, Stuttgart 2018."),
        "level": None,              # each topic prints its own CEFR level
        "group": lambda t: f"{t['sectionNumber']}. {t['section']}",
        "groupOrder": lambda t: len(t["sectionNumber"]) if set(t["sectionNumber"]) == {"I"}
                                else {"IV": 4, "V": 5, "VI": 6, "VII": 7}.get(t["sectionNumber"], 99),
        "order": lambda t: t["page"],
    },
    "b2-grammar": {
        "file": "b2-grammar-source.json",
        "title": "Deutsche Grammatik – Niveau B2",
        "credit": ("Generated for this project by the project owner with the "
                   "german-vocab/german-grammar Claude skill, which composes its own "
                   "explanations and example sentences rather than reproducing a "
                   "published course. Rules and examples in German and English."),
        "level": "B2",              # one level for the whole document
        "group": lambda t: t["section"],
        "groupOrder": lambda t: 50,
        "order": lambda t: t["number"],
    },
    "web-b1": {
        "file": "web-grammar-source.json",
        "title": "B1 grammar not covered by the course documents",
        "credit": ("Zustandspassiv from deutsch-lernen-goethe-a1-c2 by Abdullah Butt, "
                   "CC BY-NC 4.0 (creativecommons.org/licenses/by-nc/4.0/); verb + preposition "
                   "list from „Der deutsche Wortschatz von A1 bis B2“, Lingster Academy."),
        "level": None,              # each topic prints its own level
        "group": lambda t: f"{t['sectionNumber']}. {t['section']}",
        "groupOrder": lambda t: 90 + len(t["sectionNumber"]),
        "order": lambda t: t["page"],
    },
}

LEVEL_ORDER = ["A1", "A2", "B1", "B2", "C1", "C2"]
EXERCISE_TYPES = {"fill", "choice", "transform", "reorder", "error", "context"}
BLANK = "___"


def norm(text: str) -> str:
    """Whitespace-normalised, with the document's footnote markers removed.

    The PDFs mark footnotes with an asterisk inside the sentence ("ich bin es*
    leider nicht"). The marker is typography, not language, so it is stripped
    on both sides of the comparison instead of being copied into learner text.
    """
    return re.sub(r"\s+", " ", text.replace("*", "")).strip()


def grounded(sentence: str, source_text: str) -> bool:
    """Is this sentence actually in the source text of its topic?

    Checked twice. Normally a whitespace-normalised substring match; failing
    that, a match with all spaces removed, because the documents highlight
    endings by spacing them out inside the word ("das Vokabul ar", "komm st").
    The fallback still requires the full character sequence in order, so it
    cannot let through a sentence the document does not contain.
    """
    needle, hay = norm(sentence).rstrip(" ."), norm(source_text)
    if needle in hay:
        return True
    return needle.replace(" ", "") in hay.replace(" ", "")


def load_sources() -> dict:
    topics = {}
    for key, spec in SOURCES.items():
        path = ROOT / spec["file"]
        if not path.exists():
            raise SystemExit(f"missing {path.name} — run the matching extractor first")
        for record in json.loads(path.read_text(encoding="utf-8")):
            if record["id"] in topics:
                raise SystemExit(f"topic id {record['id']} appears in two sources")
            record["sourceKey"] = key
            topics[record["id"]] = record
    return topics


def load_tables() -> dict[str, list[dict]]:
    """Paradigm tables, written for this project and keyed by topic id.

    The corpus explains the article, pronoun and adjective-ending systems in
    prose; exactly one of its 626 rules is a full paradigm, so a table cannot be
    extracted from it. These are written separately because those systems are
    closed and finite — they can be checked against any reference grammar, which
    is what makes writing them different from inventing grammar.
    """
    path = ANNOTATIONS / TABLES_FILE
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    tables = data.get("tables", {})
    for tid, group in tables.items():
        for table in group:
            width = len(table["columns"])
            for row in table["rows"]:
                if len(row) != width:
                    raise SystemExit(
                        f"{TABLES_FILE}: {tid} / {table['caption']!r} has a row of "
                        f"{len(row)} in a table {width} wide")
    return tables


def load_comparisons() -> dict[str, dict]:
    """Side-by-side comparisons of two structures learners confuse.

    Written for this project, like the paradigm tables, but for a different
    reason and with a weaker claim. A declension table is a closed system anyone
    can check; choosing *which* two structures to set against each other, and
    what to say about each, is a teaching decision. So each one is attached to a
    topic that actually teaches at least one side of it, the distinctions are
    the standard ones every reference grammar states, and the annotation file
    says out loud that it was written here.
    """
    path = ANNOTATIONS / COMPARISONS_FILE
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    found = data.get("comparisons", {})
    for tid, comparison in found.items():
        for field in ("left", "right"):
            if not str(comparison.get(field, "")).strip():
                raise SystemExit(f"{COMPARISONS_FILE}: {tid} has no {field} heading")
        if not comparison.get("rows"):
            raise SystemExit(f"{COMPARISONS_FILE}: {tid} has no rows")
        for row in comparison["rows"]:
            for field in ("aspect", "left", "right"):
                if not str(row.get(field, "")).strip():
                    raise SystemExit(
                        f"{COMPARISONS_FILE}: {tid} has a row with an empty {field}")
    return found


def load_wordorder() -> dict[tuple[str, str], list[str]]:
    """Highlights written by hand for the topics the automatic rule cannot reach.

    Word-order topics teach a *position*, and their exercises answer with a
    whole sentence, so `focus_forms` finds nothing to mark in them — 114
    examples came out bare. The alternative to writing these was a parser
    guessing which word is the finite verb, and a wrong guess there teaches
    wrong grammar, so they are written one example at a time.

    Keyed on the topic and the example's exact text, so an annotation that no
    longer matches any example is a build failure rather than a silent no-op.
    """
    path = ANNOTATIONS / WORDORDER_FILE
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[tuple[str, str], list[str]] = {}
    for entry in data.get("marks", []):
        key = (entry["topic"], entry["text"])
        if key in out:
            raise SystemExit(f"{WORDORDER_FILE}: {entry['topic']} annotates the same example twice")
        out[key] = entry["mark"]
    return out


def load_translations() -> dict[str, str]:
    """English for the German in the examples, written for this project.

    The corpus carries no translation. Its `note` field names the point being
    made ("regular ending -e"), which is an annotation, not a gloss, so a
    learner who cannot yet read the sentence has nothing to go on. These are
    keyed on the example's exact German, because the same sentence recurs
    across topics and should read the same way in each.
    """
    path = ANNOTATIONS / TRANSLATIONS_FILE
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, str] = {}
    for german, english in data.get("translations", {}).items():
        text = english.strip()
        if not text:
            raise SystemExit(f"{TRANSLATIONS_FILE}: {german!r} has an empty translation")
        out[german.strip()] = text
    return out


def load_formulas() -> dict[str, list[dict]]:
    """The shape of a construction, as a row of slots, written by hand.

    A clause pattern is a shape, and prose is a bad way to show one. Deriving
    these would need a parser over the explanation text, and a wrong pattern
    teaches wrong grammar, so they are written and checked instead.

    A slot is "text" or "text:role", the role being one of the four classes the
    example highlights use — so a connector is the same colour in the formula
    and in the sentence under it.
    """
    path = ANNOTATIONS / FORMULAS_FILE
    if not path.exists():
        return {}
    data = json.loads(path.read_text(encoding="utf-8"))
    out: dict[str, list[dict]] = {}
    for tid, formulas in data.get("formulas", {}).items():
        built = []
        for formula in formulas:
            slots = []
            for slot in formula["slots"]:
                text, role = slot, ""
                # A slot's text is prose and may itself contain a colon
                # ("(spoken: Dative)"), so a suffix only counts as a role when
                # it is a single word. A misspelt role is still a single word
                # and still stops the build.
                head, sep, tail = slot.rpartition(":")
                if sep and tail and " " not in tail:
                    if tail not in MARK_ROLES:
                        raise SystemExit(
                            f"{FORMULAS_FILE}: {tid}: {slot!r} names an unknown role {tail!r}")
                    text, role = head, tail
                if not text.strip():
                    raise SystemExit(f"{FORMULAS_FILE}: {tid} has an empty slot")
                slots.append({"text": text, "role": role})
            if len(slots) < 2:
                raise SystemExit(
                    f"{FORMULAS_FILE}: {tid}: a formula of one slot is not a shape")
            built.append({"caption": formula.get("caption", ""), "slots": slots})
        out[tid] = built
    return out


def spans_for(text: str, marks: list[str], where: str) -> list[dict]:
    """Turn written marks into character spans, each with the word class it names.

    A mark is the word to highlight. "word[2]" picks the second occurrence,
    which is how a sentence containing the same word twice — one clause's verb
    and the next one's — can mark only the one that is meant. "word:role" names
    its class, which the app colours; a mark with no role gets the neutral tone
    every automatic mark uses.

    The role is written per mark rather than per word because the same string is
    a different class in different sentences: "auf" is a preposition in one
    example and a separable prefix in another.

    A mark that does not occur is a mistake in the annotation, and it stops the
    build: a highlight silently going missing is exactly the failure this file
    exists to avoid.
    """
    spans: list[dict] = []
    for mark in marks:
        token, role = mark, ""
        if ":" in token:
            token, role = token.rsplit(":", 1)
            if role not in MARK_ROLES:
                raise SystemExit(
                    f"{WORDORDER_FILE}: {where}: {mark!r} names an unknown role {role!r}")
        wanted = 1
        matched = re.fullmatch(r"(.+)\[(\d+)\]", token)
        if matched:
            token, wanted = matched.group(1), int(matched.group(2))
        found = [m for m in re.finditer(
            r"(?<![\wÄÖÜäöüß])" + re.escape(token) + r"(?![\wÄÖÜäöüß])", text)]
        if len(found) < wanted:
            raise SystemExit(
                f"{WORDORDER_FILE}: {where}: {mark!r} occurs {len(found)} time(s) in {text!r}")
        hit = found[wanted - 1]
        spans.append({"start": hit.start(), "end": hit.end(), "role": role})
    spans.sort(key=lambda s: (s["start"], -s["end"]))
    kept: list[dict] = []
    for span in spans:
        if kept and span["start"] < kept[-1]["end"]:
            continue
        kept.append(span)
    return kept


def focus_forms(exercises: list[dict]) -> set[str]:
    """The forms a topic actually teaches, as its own exercises state them.

    This is the corpus pointing at its own target: the answer to a gap-fill for
    the perfect tense is the participle, and the answer to a conjugation choice
    is the conjugated verb. Nothing here guesses which word in a sentence is the
    verb — a guess that is wrong teaches the wrong grammar, and across this
    corpus the annotations name a word in the sentence only 4 % of the time.

    Only short answers from form-targeting exercises count. A whole-sentence
    answer would contribute every word in it, including the place names.
    """
    forms: set[str] = set()
    for exercise in exercises:
        if exercise.get("type") not in FORM_EXERCISES:
            continue
        for answer in exercise.get("answers", []):
            answer = answer.strip()
            if not answer or len(answer.split()) > 2:
                continue
            for word in re.findall(r"[A-Za-zÄÖÜäöüß]{2,}", answer):
                if word.lower() in NOT_A_FORM:
                    continue
                forms.add(word)
    return forms


def mark_examples(examples: list[dict], forms: set[str]) -> int:
    """Record where each taught form sits in each example, as character spans.

    Spans rather than a word list, so the app slices the string it was given and
    never runs a match of its own — what is highlighted is decided once, here,
    where it can be checked.

    These carry no role. They come from the topic's own exercise answers, which
    say which form is being taught and nothing about its word class, so they are
    highlighted in the neutral tone. Roles are written by hand in wordorder.json.
    """
    marked = 0
    for example in examples:
        text = example.get("de", "")
        spans: list[dict] = []
        for form in forms:
            for found in re.finditer(
                r"(?<![\wÄÖÜäöüß])" + re.escape(form) + r"(?![\wÄÖÜäöüß])", text, re.IGNORECASE
            ):
                spans.append({"start": found.start(), "end": found.end(), "role": ""})
        # Overlapping spans would render as nested highlights; keep the longest
        # at each position by preferring an earlier start and a later end.
        spans.sort(key=lambda s: (s["start"], -s["end"]))
        kept: list[dict] = []
        for span in spans:
            if kept and span["start"] < kept[-1]["end"]:
                continue
            kept.append(span)
        example["marks"] = kept
        if kept:
            marked += 1
    return marked


def main() -> int:
    source = load_sources()
    # tables.json is reference data keyed by topic id, not a list of topics.
    reference = {TABLES_FILE, COMPARISONS_FILE, WORDORDER_FILE, TRANSLATIONS_FILE,
                 FORMULAS_FILE}
    files = sorted(f for f in ANNOTATIONS.glob("*.json") if f.name not in reference)
    tables = load_tables()
    comparisons = load_comparisons()
    hand_marks = load_wordorder()
    translations = load_translations()
    formulas = load_formulas()
    if not files:
        raise SystemExit(f"no annotation files in {ANNOTATIONS}")

    problems: list[str] = []
    topics: list[dict] = []
    seen: set[str] = set()
    marked_examples = 0
    with_tables = 0
    with_formula = 0
    with_comparison = 0
    by_hand = 0
    translated = 0
    untranslated: set[str] = set()
    used_translations: set[str] = set()

    for path in files:
        data = json.loads(path.read_text(encoding="utf-8"))
        for entry in data["topics"]:
            tid = entry["id"]
            where = f"{path.name}:{tid}"
            if tid not in source:
                problems.append(f"{where}: no such topic in any source document")
                continue
            if tid in seen:
                problems.append(f"{where}: topic annotated twice")
                continue
            seen.add(tid)
            src = source[tid]
            spec = SOURCES[src["sourceKey"]]

            for example in entry.get("examples", []):
                if not grounded(example["de"], src["text"]):
                    problems.append(f"{where}: example not found in the source: {example['de'][:70]!r}")

            exercises = []
            for index, ex in enumerate(entry.get("exercises", []), start=1):
                eid = f"{tid}-e{index}"
                kind = ex.get("type")
                if kind not in EXERCISE_TYPES:
                    problems.append(f"{where} #{index}: unknown exercise type {kind!r}")
                    continue
                answers = [a for a in ex.get("answers", []) if a.strip()]
                if not answers:
                    problems.append(f"{where} #{index}: no answer given")
                if kind == "transform" and not ex.get("from"):
                    problems.append(f"{where} #{index}: transform exercise has no 'from' sentence")
                # fill always needs a gap; context may instead offer options.
                needs_blank = kind == "fill" or (kind == "context" and not ex.get("options"))
                if needs_blank and BLANK not in ex.get("text", ""):
                    problems.append(f"{where} #{index}: {kind} exercise has no '{BLANK}' blank")
                if kind == "choice":
                    options = ex.get("options", [])
                    if len(options) < 3:
                        problems.append(f"{where} #{index}: choice needs at least 3 options")
                    if len(set(options)) != len(options):
                        problems.append(f"{where} #{index}: duplicate options")
                    for answer in answers:
                        if answer not in options:
                            problems.append(f"{where} #{index}: answer {answer!r} is not among the options")
                if kind == "reorder" and not ex.get("tokens"):
                    problems.append(f"{where} #{index}: reorder exercise has no tokens")
                if ex.get("source") and "sentence" in ex:
                    if not grounded(ex["sentence"], src["text"]):
                        problems.append(
                            f"{where} #{index}: marked as a source sentence but not found: {ex['sentence'][:70]!r}")
                exercises.append({
                    "id": eid,
                    "topicId": tid,
                    "type": kind,
                    "prompt": ex["prompt"],
                    "text": ex.get("text", ""),
                    "from": ex.get("from", ""),
                    "options": ex.get("options", []),
                    "answers": answers,
                    "tokens": ex.get("tokens", []),
                    "hint": ex.get("hint", ""),
                    "explain": ex.get("explain", ""),
                    "fromSource": bool(ex.get("source")),
                })

            if not exercises:
                problems.append(f"{where}: no exercises")

            level = spec["level"] or src.get("level")
            if level not in LEVEL_ORDER:
                problems.append(f"{where}: unusable level {level!r}")

            topics.append({
                "id": tid,
                "language": "de",
                "level": level,
                "group": spec["group"](src),
                "groupOrder": spec["groupOrder"](src),
                "order": spec["order"](src),
                "title": src["title"],
                "titleEn": entry["titleEn"],
                "summary": entry["summary"],
                "category": entry.get("category", "Grammatik"),
                "tags": entry.get("tags", []),
                "difficulty": entry.get("difficulty", 3),
                "prerequisites": entry.get("prerequisites", []),
                "explanation": entry.get("explanation", []),
                "rules": entry.get("rules", []),
                "examples": entry.get("examples", []),
                "tables": tables.get(tid, []),
                "formulas": formulas.get(tid, []),
                "comparison": comparisons.get(tid),
                "exercises": exercises,
                "kursbuch": src.get("kursbuch", ""),
                "subsection": src.get("subsection", ""),
                "source": spec["title"],
                "sourceKey": src["sourceKey"],
                "sourcePage": src["page"],
                "sourcePages": src["pages"],
                "subtopics": src.get("subtopics", []),
            })

            topic = topics[-1]
            marked_examples += mark_examples(topic["examples"], focus_forms(exercises))
            # Hand-written marks come after, and win: they were written for an
            # example the automatic rule had nothing to say about.
            for example in topic["examples"]:
                written = hand_marks.pop((tid, example.get("de", "")), None)
                if written is None:
                    continue
                was_bare = not example["marks"]
                example["marks"] = spans_for(example["de"], written, tid)
                if was_bare and example["marks"]:
                    marked_examples += 1
                by_hand += 1
            for example in topic["examples"]:
                english = translations.get(example.get("de", "").strip())
                if english:
                    example["en"] = english
                    used_translations.add(example["de"].strip())
                    translated += 1
                else:
                    untranslated.add(example.get("de", ""))
            if topic["formulas"]:
                with_formula += 1
            if topic["tables"]:
                with_tables += 1
            if topic["comparison"]:
                with_comparison += 1

    missing = sorted(tid for tid in source if tid not in seen)
    if missing:
        problems.append(f"{len(missing)} topic(s) in a source with no annotation: {missing[:8]}"
                        + (" …" if len(missing) > 8 else ""))

    for topic in topics:
        for prerequisite in topic["prerequisites"]:
            if prerequisite not in source:
                problems.append(f"{topic['id']}: prerequisite {prerequisite!r} does not exist")
            elif prerequisite == topic["id"]:
                problems.append(f"{topic['id']}: is its own prerequisite")

    stale_formulas = sorted(set(formulas) - seen)
    if stale_formulas:
        for tid in stale_formulas[:10]:
            problems.append(f"{FORMULAS_FILE}: {tid} is not a topic in any source")

    if hand_marks:
        for (tid, text) in list(hand_marks)[:10]:
            problems.append(f"{WORDORDER_FILE}: {tid} annotates {text!r}, which is not one of its examples")

    stale = sorted(set(translations) - used_translations)
    if stale:
        for text in stale[:10]:
            problems.append(f"{TRANSLATIONS_FILE}: {text!r} is not an example in any topic")

    if problems:
        print(f"{len(problems)} problem(s):", file=sys.stderr)
        for problem in problems[:60]:
            print("  -", problem, file=sys.stderr)
        return 1

    topics.sort(key=lambda t: (LEVEL_ORDER.index(t["level"]), t["groupOrder"], t["order"], t["title"]))

    levels = []
    for level in LEVEL_ORDER:
        in_level = [t for t in topics if t["level"] == level]
        if not in_level:
            continue
        groups = []
        for topic in in_level:
            if not groups or groups[-1]["name"] != topic["group"]:
                groups.append({"name": topic["group"], "topics": []})
            groups[-1]["topics"].append(topic["id"])
        levels.append({
            "level": level,
            "topicCount": len(in_level),
            "sources": sorted({t["source"] for t in in_level}),
            "groups": groups,
        })

    database = {
        "meta": {
            "language": "de",
            "sources": [
                {"key": key, "title": spec["title"], "credit": spec["credit"],
                 "topicCount": sum(1 for t in topics if t["sourceKey"] == key)}
                for key, spec in SOURCES.items()
            ],
            "levels": [entry["level"] for entry in levels],
            "topicCount": len(topics),
            "exerciseCount": sum(len(t["exercises"]) for t in topics),
            "exampleCount": sum(len(t["examples"]) for t in topics),
        },
        "levels": levels,
        "topics": topics,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(database, ensure_ascii=False, indent=1), encoding="utf-8")
    meta = database["meta"]
    print(f"topics {meta['topicCount']} · examples {meta['exampleCount']} · "
          f"exercises {meta['exerciseCount']} -> {OUT}")
    print(f"highlighted  {marked_examples} of {meta['exampleCount']} examples carry a taught form")
    print(f"formulas     {with_formula} topic(s) carry a construction shape")
    print(f"tables       {with_tables} topic(s) carry a paradigm table")
    print(f"comparisons  {with_comparison} topic(s) carry a side-by-side comparison")
    print(f"by hand      {by_hand} example(s) use written word-order marks")
    roles = Counter(span["role"] or "(neutral)"
                    for topic in topics for example in topic["examples"]
                    for span in example["marks"])
    print("roles        " + ", ".join(f"{name} {count}" for name, count in roles.most_common()))
    print(f"translated   {translated} of {meta['exampleCount']} examples carry English")
    if untranslated:
        print(f"  no English for {len(untranslated)} distinct example(s); "
              f"the app shows the German alone")
    for entry in levels:
        print(f"  {entry['level']}: {entry['topicCount']} topics in {len(entry['groups'])} groups")
    return 0


if __name__ == "__main__":
    sys.exit(main())
