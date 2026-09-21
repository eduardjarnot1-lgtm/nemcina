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
from pathlib import Path

ROOT = Path(__file__).resolve().parent
ANNOTATIONS = ROOT / "annotations" / "grammar"
TABLES_FILE = "tables.json"
COMPARISONS_FILE = "comparisons.json"

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
    """
    marked = 0
    for example in examples:
        text = example.get("de", "")
        spans: list[list[int]] = []
        for form in forms:
            for found in re.finditer(
                r"(?<![\wÄÖÜäöüß])" + re.escape(form) + r"(?![\wÄÖÜäöüß])", text, re.IGNORECASE
            ):
                spans.append([found.start(), found.end()])
        # Overlapping spans would render as nested highlights; keep the longest
        # at each position by preferring an earlier start and a later end.
        spans.sort(key=lambda s: (s[0], -s[1]))
        kept: list[list[int]] = []
        for span in spans:
            if kept and span[0] < kept[-1][1]:
                continue
            kept.append(span)
        example["marks"] = kept
        if kept:
            marked += 1
    return marked


def main() -> int:
    source = load_sources()
    # tables.json is reference data keyed by topic id, not a list of topics.
    reference = {TABLES_FILE, COMPARISONS_FILE}
    files = sorted(f for f in ANNOTATIONS.glob("*.json") if f.name not in reference)
    tables = load_tables()
    comparisons = load_comparisons()
    if not files:
        raise SystemExit(f"no annotation files in {ANNOTATIONS}")

    problems: list[str] = []
    topics: list[dict] = []
    seen: set[str] = set()
    marked_examples = 0
    with_tables = 0
    with_comparison = 0

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
    print(f"tables       {with_tables} topic(s) carry a paradigm table")
    print(f"comparisons  {with_comparison} topic(s) carry a side-by-side comparison")
    for entry in levels:
        print(f"  {entry['level']}: {entry['topicCount']} topics in {len(entry['groups'])} groups")
    return 0


if __name__ == "__main__":
    sys.exit(main())
