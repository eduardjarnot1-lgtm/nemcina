"""
What the grammar section is missing, counted.

Highlighting, tables and worked examples all fail the same quiet way: the page
still renders, and the learner simply is not shown the thing the topic is
about. So the gaps are measured rather than assumed, and the measurement is a
tool rather than a one-off script, because the only way a corpus of 136 topics
stays annotated is if the holes are visible.

    python3 app/tools/audit_grammar.py            # the report
    python3 app/tools/audit_grammar.py --check    # fail if a gate is breached

Four defect classes, each of which was found in real data:

  bare      an example with no highlighting at all, in a topic that teaches a
            form. 239 of 675 examples were in this state.

  partial   an example offering alternatives — "Stattdessen / Dafür" — where
            only some are marked. The learner is shown one of the two things
            the line exists to teach.

  stray     a mark on a word that is not the teaching point. The derivation
            takes the topic's exercise answers and regex-matches them across
            every example, so a topic whose answer is "dem" highlighted the
            "dem" in "auf dem neuesten Stand".

  nameless  a topic whose rules name specific words that appear in its examples
            unmarked.
"""

from __future__ import annotations

import json
import re
import sys
from collections import Counter
from pathlib import Path

DATA = Path(__file__).resolve().parents[1] / "data" / "grammar.json"

# Words so common that a bare automatic mark on one is far more likely to be an
# accident of matching than a teaching point. A topic that genuinely teaches
# them marks them by hand, with a role, and is not flagged.
COMMON = {
    "der", "die", "das", "den", "dem", "des", "ein", "eine", "einen", "einem",
    "einer", "eines", "ist", "sind", "war", "waren", "hat", "haben", "hatte",
    "wird", "werden", "nicht", "und", "oder", "aber", "man", "es", "sie", "er",
    "ich", "du", "wir", "ihr", "zu", "in", "an", "auf", "mit", "von", "für",
}


def marked_texts(example: dict) -> list[str]:
    return [example["de"][m["start"]:m["end"]] for m in example["marks"]]


def unmarked_branches(text: str, spans: list[dict]) -> list[str]:
    """Which alternatives of a slashed line carry no highlight at all.

    "Stattdessen / Dafür lernen wir …" teaches two words and marked one.

    An alternative is a *branch* of the line — everything between two slashes —
    not the single word touching the slash. Two earlier versions compared words
    and both got this wrong. Taking any run of capitalised words at the start of
    the line flagged "Das Buch ist auf / unter / an dem Tisch" as offering "Das"
    and "Buch"; taking only the words immediately either side of a slash then
    flagged "Statt der Grünen / Statt den Grünen wählt Lisa …", where the
    alternation is genitive against dative and both articles are in fact marked
    — the words next to the slash, "Grünen" and "Statt", are the parts that do
    not vary. A branch is the unit that actually alternates, and when a branch
    is one word long the two readings agree, so the case this check exists for
    is still caught.
    """
    if "/" not in text:
        return []
    bounds, start = [], 0
    for cut in [m.start() for m in re.finditer(r"/", text)] + [len(text)]:
        bounds.append((start, cut))
        start = cut + 1
    unmarked = []
    for left, right in bounds:
        if any(left <= span["start"] < right for span in spans):
            continue
        branch = text[left:right].strip()
        if not re.search(r"[\wÄÖÜäöüß]", branch):
            continue  # a paradigm's empty slot, written "-": there is no
            # indefinite plural article, so that branch has nothing to mark.
        unmarked.append(branch if len(branch) <= 24 else branch[:21] + "…")
    return unmarked


def audit(topics: list[dict]) -> dict:
    bare: list[tuple[str, str]] = []
    partial: list[tuple[str, str, str]] = []
    stray: list[tuple[str, str, str]] = []
    nameless: list[tuple[str, str, str]] = []

    for topic in topics:
        rule_text = " ".join(topic.get("rules", []))
        # Words the rules name in italic-free prose: capitalised or quoted terms
        # the topic is explicitly about.
        named = set(re.findall(r"[„“\"']([^„“\"']{3,24})[„“\"']", rule_text))

        for example in topic["examples"]:
            text = example["de"]
            # Four "examples" are English notes the corpus stored in the German
            # field ("The endings match those of the definite article."). They
            # are prose about the topic, not an instance of it, and there is
            # nothing in them to highlight.
            if not re.search(r"[äöüßÄÖÜ]", text) and len(text.split()) > 5 \
                    and not re.search(r"[A-ZÄÖÜ][a-zäöüß]+\s+[a-zäöüß]+en\b", text):
                continue
            marks = marked_texts(example)
            lowered = {m.lower() for m in marks}

            if not marks:
                bare.append((topic["id"], text))
                continue

            missing = unmarked_branches(text, example["marks"])
            if missing:
                partial.append((topic["id"], text, " | ".join(missing)))

            for mark, span in zip(marks, example["marks"]):
                if span["role"]:
                    continue  # written by hand, with a class: deliberate
                if span["tier"] == "support":
                    continue  # deliberately secondary, not a mis-aimed highlight
                if mark.lower() in COMMON and mark.lower() not in rule_text.lower():
                    stray.append((topic["id"], text, mark))

            for word in named:
                if word.lower() in text.lower() and word.lower() not in lowered:
                    nameless.append((topic["id"], text, word))

    return {"bare": bare, "partial": partial, "stray": stray, "nameless": nameless}


def main(argv: list[str]) -> int:
    database = json.loads(DATA.read_text(encoding="utf-8"))
    topics = database["topics"]
    examples = [e for t in topics for e in t["examples"]]
    found = audit(topics)

    print("GRAMMAR ANNOTATION AUDIT\n")
    print(f"topics   : {len(topics)}")
    print(f"examples : {len(examples)}")
    marked = sum(1 for e in examples if e["marks"])
    print(f"highlighted : {marked} ({marked * 100 // len(examples)}%)")
    print(f"tables      : {sum(1 for t in topics if t['tables'])} topic(s)")
    print(f"formulas    : {sum(1 for t in topics if t['formulas'])} topic(s)")
    print(f"choosers    : {sum(1 for t in topics if t.get('chooser'))} topic(s)")
    print()

    for name, rows in found.items():
        print(f"{name:9} {len(rows)}")
    print()

    bare_topics = [t for t in topics if t["examples"] and not any(e["marks"] for e in t["examples"])]
    print(f"topics with no highlighting anywhere: {len(bare_topics)}")
    for topic in bare_topics:
        print(f"   {topic['level']:<3} {topic['id']:<52} {topic['title'][:40]}")
    print()

    for name in ("partial", "stray"):
        rows = found[name]
        if not rows:
            continue
        print(f"{name.upper()} (first 12 of {len(rows)})")
        for row in rows[:12]:
            print(f"   {row[0]:<40} {row[2]:<22} {row[1][:60]}")
        print()

    by_level = Counter(t["level"] for t in bare_topics)
    print("bare topics by level:", dict(sorted(by_level.items())))

    if "--check" in argv:
        problems = []
        if found["bare"]:
            problems.append(f"{len(found['bare'])} German example(s) carry no highlighting at all")
        if found["partial"]:
            problems.append(f"{len(found['partial'])} example(s) mark only some of their alternatives")
        if found["stray"]:
            problems.append(f"{len(found['stray'])} mark(s) land on a word the topic does not teach")
        if found["nameless"]:
            problems.append(f"{len(found['nameless'])} example(s) leave a word their topic's rules "
                            f"name by hand unmarked")
        if bare_topics:
            problems.append(f"{len(bare_topics)} topic(s) have no highlighting on any example")
        if problems:
            print("\nPROBLEMS")
            for problem in problems:
                print("  -", problem)
            return 1
        print("\nAll annotation checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
