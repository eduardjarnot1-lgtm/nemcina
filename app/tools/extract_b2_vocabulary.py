#!/usr/bin/env python3
"""Extract the B2 vocabulary list supplied by the project owner.

Usage:  python3 extract_b2_vocabulary.py --pdf German_Vocabulary_B2.pdf

The document is a generated three-column table — German headword, English
gloss, example sentence with its translation — grouped under 25 topic
headings. Unlike the Goethe Wortlisten, its columns survive text extraction
cleanly, because every cell is a separate text run in a known font:

    Helvetica-Bold 22     the title
    Helvetica-Bold 14     a topic heading
    Helvetica-Bold 10     the repeated "German / English / Example sentence"
    Helvetica-Bold 11     a headword
    Helvetica      10     an English gloss
    Helvetica-Oblique 9.5 the example sentence, then its translation

So the parse keys on the font rather than on column positions or line
counting, which is what makes it reliable: a wrapped cell is simply two runs
in the same font, and consecutive runs of one font are one cell.

The one genuine ambiguity is inside the example cell, which holds two
sentences in the same font. They are split on the first run that ends a
sentence: everything up to and including it is the German, the rest is the
English. An entry where that split cannot be made is reported, never guessed.

Writes b2-vocabulary-source.json and refuses to write anything at all if the
document does not parse cleanly, so a silent partial import cannot happen.
"""

from __future__ import annotations

import argparse
import json
import re
import sys
from pathlib import Path

from pypdf import PdfReader

HEADWORD = ("/Helvetica-Bold", 11.0)
GLOSS = ("/Helvetica", 10.0)
EXAMPLE = ("/Helvetica-Oblique", 9.5)
TOPIC = ("/Helvetica-Bold", 14.0)
TABLE_HEADER = ("/Helvetica-Bold", 10.0)

TABLE_HEADER_WORDS = {"German", "English", "Example sentence"}
SENTENCE_END = re.compile(r"[.!?…]['\"»]?$")

# German nouns are listed with their article; the article is metadata, not part
# of the word, and the rest of the pipeline stores it separately.
ARTICLE = re.compile(r"^(der|die|das)\s+(.+)$")


def runs(pdf: Path) -> list[tuple[tuple[str, float], str]]:
    """Every non-empty text run, in reading order, tagged with its style."""
    collected: list[tuple[tuple[str, float], str]] = []

    def visit(text, _cm, _tm, font_dict, font_size):
        stripped = text.strip()
        if not stripped:
            return
        name = (font_dict or {}).get("/BaseFont", "?")
        collected.append(((name, float(font_size)), stripped))

    for page in PdfReader(str(pdf)).pages:
        page.extract_text(visitor_text=visit)
    return collected


def group(collected):
    """Merge consecutive runs sharing a style into one cell.

    A cell that wrapped onto a second line is two runs in the same font; this
    is what puts "das lebenslange" and "Lernen" back together.
    """
    grouped: list[tuple[tuple[str, float], list[str]]] = []
    for style, text in collected:
        if grouped and grouped[-1][0] == style:
            grouped[-1][1].append(text)
        else:
            grouped.append((style, [text]))
    return grouped


def split_example(parts: list[str], where: str, problems: list[str]):
    """Divide the example cell into the German sentence and its translation."""
    for index, part in enumerate(parts):
        if SENTENCE_END.search(part):
            german = " ".join(parts[: index + 1])
            english = " ".join(parts[index + 1 :])
            if english:
                return german, english
            break
    problems.append(f"{where}: cannot tell the example from its translation: {parts!r}")
    return "", ""


def parse(pdf: Path) -> tuple[list[dict], list[str], list[str]]:
    grouped = group(runs(pdf))
    entries: list[dict] = []
    topics: list[str] = []
    problems: list[str] = []

    topic = ""
    pending: dict | None = None

    def close(current: dict | None):
        if current is None:
            return
        where = f"{current['topic']} / {current['word']}"
        if not current["gloss"]:
            problems.append(f"{where}: no English gloss")
            return
        if not current["example_parts"]:
            problems.append(f"{where}: no example sentence")
            return
        german, english = split_example(current["example_parts"], where, problems)
        if not german:
            return
        entries.append({
            "word": current["word"],
            "article": current["article"],
            "translation": current["gloss"],
            "example": german,
            "exampleTranslation": english,
            "topic": current["topic"],
        })

    for style, parts in grouped:
        text = " ".join(parts)
        if style == TOPIC:
            close(pending)
            pending = None
            topic = text
            topics.append(text)
        elif style == TABLE_HEADER and text in TABLE_HEADER_WORDS:
            continue
        elif style == HEADWORD:
            close(pending)
            match = ARTICLE.match(text)
            pending = {
                "word": match.group(2) if match else text,
                "article": match.group(1) if match else "",
                "gloss": "",
                "example_parts": [],
                "topic": topic,
            }
        elif style == GLOSS and pending is not None:
            pending["gloss"] = text
        elif style == EXAMPLE and pending is not None:
            pending["example_parts"].extend(parts)
    close(pending)

    return entries, topics, problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__,
                                     formatter_class=argparse.RawDescriptionHelpFormatter)
    parser.add_argument("--pdf", required=True, type=Path)
    parser.add_argument("--out", type=Path,
                        default=Path(__file__).resolve().parent / "b2-vocabulary-source.json")
    parser.add_argument("--expect", type=int, default=0,
                        help="entry count the document claims; mismatch is fatal")
    args = parser.parse_args()

    if not args.pdf.exists():
        print(f"missing {args.pdf}", file=sys.stderr)
        return 1

    entries, topics, problems = parse(args.pdf)

    seen: dict[str, str] = {}
    for entry in entries:
        key = entry["word"].lower()
        if key in seen:
            problems.append(f"{entry['word']}: listed twice ({seen[key]}, {entry['topic']})")
        seen[key] = entry["topic"]

    for entry in entries:
        # An example that does not contain the headword teaches the wrong
        # sentence. German inflects, so this is a report, not a rule.
        stem = entry["word"][:5].lower()
        if stem and stem not in entry["example"].lower():
            problems.append(
                f"{entry['topic']} / {entry['word']}: the example may not use the word "
                f"({entry['example']!r})")

    print(f"entries: {len(entries)}")
    print(f"topics : {len(topics)}")
    if args.expect and len(entries) != args.expect:
        problems.insert(0, f"expected {args.expect} entries, parsed {len(entries)}")

    fatal = [p for p in problems if "may not use the word" not in p]
    soft = [p for p in problems if "may not use the word" in p]
    for problem in soft:
        print(f"  note: {problem}")
    for problem in fatal:
        print(f"  ERROR: {problem}", file=sys.stderr)

    if fatal:
        print(f"\n{len(fatal)} problem(s) — refusing to write {args.out.name}", file=sys.stderr)
        return 1

    args.out.write_text(
        json.dumps({
            "source": "German Vocabulary — Level B2 (supplied by the project owner)",
            "level": "B2",
            "topics": topics,
            "entries": entries,
        }, ensure_ascii=False, indent=1) + "\n",
        encoding="utf-8")
    print(f"wrote {len(entries)} entries -> {args.out}")
    return 0


if __name__ == "__main__":
    raise SystemExit(main())
