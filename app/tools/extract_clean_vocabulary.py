#!/usr/bin/env python3
"""Extract a "clean rebuild" vocabulary list.

Usage:
  python3 extract_clean_vocabulary.py --pdf German_Vocabulary_A1_600.pdf \
      --level A1 --expect 600 --out clean-a1-source.json
  python3 extract_clean_vocabulary.py --json German_Vocabulary_B1_1000.json \
      --level B1 --expect 1000 --out clean-b1-source.json
  python3 extract_clean_vocabulary.py --json part1of3.json part2of3.json part3of3.json \
      --level B2 --expect 1500 --out clean-b2-source.json

Some lists are supplied as JSON rather than as a PDF. They are read and checked
the same way and reduced to the same shape, so the build sees one kind of
source and the difference stops at this file.

A long list may arrive split across several files. They are read in the order
given and checked as one list, so a headword repeated across two parts is
caught exactly as it would be within one. Concatenating them by hand outside
this script would skip that check, which is the whole reason --json takes more
than one path.

These lists were composed for this project rather than taken from a course, so
they are the ones that carry no licensing question. They use the same generated
three-column layout as the B2 list — German headword, English gloss, example
sentence with its translation, grouped under topic headings — and the parse
keys on the font rather than on column positions, because every cell is its own
text run:

    Helvetica-Bold 22     the title
    Helvetica-Bold 14     a topic heading
    Helvetica-Bold 10     the repeated "German / English / Example sentence"
    Helvetica-Bold 11     a headword
    Helvetica      10     an English gloss
    Helvetica-Oblique 9.5 the example sentence, then its translation

A wrapped cell is two runs in one font, so consecutive runs of a font are one
cell. The one real ambiguity is the example cell, which holds two sentences in
the same font; they split on the first run that ends a sentence. An entry where
that cannot be done is reported, never guessed.

Damaged topic headings
----------------------
The generator wrote the Czech topic names with a WinAnsi font. Every character
outside that encoding — ř, č, ě, Č — was dropped and ReportLab substituted a
ZapfDingbats box, so "Počasí" arrives as "Po", a box, and "así". The German and
English entry data is unaffected; only the headings are.

Two things make this safe to repair rather than guess at. Each heading is
"Czech — English" and the English half is untouched, so every repair is checked
against a label the document itself still states. And the repairs are an
explicit table below, not a rule: a damaged heading with no entry in it stops
the extraction rather than reaching a learner mangled.

Nothing is written unless every entry parses and the totals match --expect, so
a silent partial import cannot happen.
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
TABLE_HEADER = ("/Helvetica-Bold", 10.0)
TOPIC_SIZE = 14.0

TABLE_HEADER_WORDS = {"German", "English", "Example sentence"}
SENTENCE_END = re.compile(r"[.!?…]['\"»]?$")
ARTICLE = re.compile(r"^(der|die|das)\s+(.+)$")

# The character the reader puts where the PDF lost one.
LOST = "�"

# Damaged heading (as extracted, with LOST for each dropped character) -> the
# Czech it was meant to be. Every one is confirmed by the English half of the
# same heading, which the encoding did not touch.
HEADING_REPAIRS = {
    f"Pozdravy a p{LOST}edstavování": "Pozdravy a představování",
    f"{LOST}ísla": "Čísla",
    f"{LOST}as a datum": "Čas a datum",
    f"Volný{LOST}as": "Volný čas",
    f"Po{LOST}así": "Počasí",
    f"M{LOST}sto a doprava": "Město a doprava",
    f"Zdraví a t{LOST}lo": "Zdraví a tělo",
    f"Oble{LOST}ení": "Oblečení",
    f"P{LOST}íroda": "Příroda",
}


def runs(pdf: Path) -> list[tuple[tuple[str, float], str]]:
    """Every non-empty text run, in reading order, tagged with its style."""
    collected: list[tuple[tuple[str, float], str]] = []

    def visit(text, _cm, _tm, font_dict, font_size):
        stripped = text.strip()
        if not stripped or font_dict is None:
            return
        collected.append(((font_dict.get("/BaseFont", ""), round(float(font_size), 1)), stripped))

    for page in PdfReader(str(pdf)).pages:
        page.extract_text(visitor_text=visit)
    return collected


def group(collected):
    """Merge consecutive runs of one style, so a wrapped cell becomes one cell.

    Runs at the heading size are merged across fonts, because a dropped
    character interrupts the heading with a ZapfDingbats box: the box becomes
    the replacement character and the heading stays one string.
    """
    cells: list[tuple[tuple[str, float], list[str]]] = []
    for style, text in collected:
        if style[1] == TOPIC_SIZE:
            piece = LOST if "ZapfDingbats" in style[0] else text
            if cells and cells[-1][0][1] == TOPIC_SIZE:
                cells[-1][1].append(piece)
            else:
                cells.append((("heading", TOPIC_SIZE), [piece]))
            continue
        if cells and cells[-1][0] == style:
            cells[-1][1].append(text)
        else:
            cells.append((style, [text]))
    return cells


REPAIRED: list[str] = []


def heading(parts: list[str], problems: list[str]) -> tuple[str, str]:
    """A "Czech — English" heading, repaired if the encoding damaged it."""
    # The box replaces a character mid-word, so the pieces join without a space;
    # everywhere else the PDF broke a line, which is a space.
    text = ""
    for piece in parts:
        if not text or piece == LOST or text.endswith(LOST):
            text += piece
        else:
            text += " " + piece
    text = re.sub(r"\s+", " ", text).strip()

    czech, _, english = text.partition("—")
    czech, english = czech.strip(), english.strip()

    if LOST in czech:
        if czech in HEADING_REPAIRS:
            czech = HEADING_REPAIRS[czech]
            REPAIRED.append(czech)
        else:
            problems.append(
                f"topic heading lost a character the repair table does not cover: "
                f"{czech!r} (English half: {english!r})")
    if LOST in english:
        problems.append(f"topic heading's English half is damaged: {english!r}")
    if not english:
        problems.append(f"topic heading has no English label: {text!r}")
    return czech, english


def split_example(parts: list[str], where: str, problems: list[str]):
    """The example cell holds the German sentence then its English translation."""
    for index, part in enumerate(parts):
        if SENTENCE_END.search(part):
            german = " ".join(parts[: index + 1]).strip()
            english = " ".join(parts[index + 1:]).strip()
            if not english:
                problems.append(f"{where}: example has no English translation")
            return german, english
    problems.append(f"{where}: example does not end a sentence: {' '.join(parts)[:60]!r}")
    return " ".join(parts).strip(), ""


def parse(pdf: Path, level: str):
    entries: list[dict] = []
    topics: list[dict] = []
    problems: list[str] = []
    czech = english = ""
    pending: dict | None = None

    def close(current):
        if current is None:
            return
        if not current.get("translation"):
            problems.append(f"{current['word']!r}: no English gloss")
        if not current.get("example"):
            problems.append(f"{current['word']!r}: no example sentence")
        entries.append(current)

    for style, parts in group(runs(pdf)):
        if style[1] == TOPIC_SIZE:
            close(pending)
            pending = None
            czech, english = heading(parts, problems)
            if english and not any(t["english"] == english for t in topics):
                topics.append({"czech": czech, "english": english})
            continue
        if style == TABLE_HEADER and set(parts) <= TABLE_HEADER_WORDS:
            continue
        if style == HEADWORD:
            close(pending)
            if not english:
                problems.append(f"entry {' '.join(parts)!r} appears before any topic heading")
            term = " ".join(parts).strip()
            article = ""
            match = ARTICLE.match(term)
            if match:
                article, term = match.group(1), match.group(2).strip()
            pending = {
                "word": term, "article": article, "type": "", "translation": "",
                "example": "", "exampleTranslation": "",
                "topic": english, "topicCzech": czech, "level": level,
            }
            continue
        if style == GLOSS and pending is not None:
            pending["translation"] = " ".join(parts).strip()
            continue
        if style == EXAMPLE and pending is not None:
            sentence, translation = split_example(parts, pending["word"], problems)
            pending["example"], pending["exampleTranslation"] = sentence, translation
            continue
    close(pending)
    return entries, topics, problems


def from_json(paths: list[Path], level: str):
    """A list supplied as JSON rather than as a PDF, in one file or several.

    It arrives already close to a card, so this only pulls out the fields the
    build uses and checks that each one is actually there. Its topic sits in
    the entry's own `categories`, Czech name and English label, which is the
    same pair the PDFs print in their headings.

    Parts are read in the order given and returned as one list, so every check
    downstream — the repeated-headword check especially — sees the whole thing
    rather than one part at a time.
    """
    entries: list[dict] = []
    topics: list[dict] = []
    problems: list[str] = []

    payload: list = []
    for path in paths:
        part = json.loads(path.read_text(encoding="utf-8"))
        if not isinstance(part, list):
            problems.append(f"{path.name}: expected a list of entries")
            continue
        payload += part
    if problems:
        return [], [], problems

    for index, raw in enumerate(payload, start=1):
        where = raw.get("word") or f"entry {index}"
        categories = raw.get("categories") or []
        if not categories:
            problems.append(f"{where}: no category")
            continue
        czech = str(categories[0].get("category", "")).strip()
        english = str(categories[0].get("subcategory", "")).strip()
        if not english:
            problems.append(f"{where}: category has no English label")
        elif not any(t["english"] == english for t in topics):
            topics.append({"czech": czech, "english": english})

        # The JSON prints the article inside `word` and again in `article`;
        # `term` is the bare headword, which is what the PDFs give.
        term = str(raw.get("term") or raw.get("word") or "").strip()
        article = str(raw.get("article", "")).strip()
        entry = {
            "word": term,
            "article": article if article in ("der", "die", "das") else "",
            # Only this list states a part of speech; the PDFs do not, so the
            # build derives it there and this stays empty.
            "type": str(raw.get("type", "")).strip(),
            "translation": str(raw.get("translation", "")).strip(),
            "example": str(raw.get("example", "")).strip(),
            "exampleTranslation": str(raw.get("exampleTranslation", "")).strip(),
            "topic": english,
            "topicCzech": czech,
            "level": level,
        }
        for field in ("word", "translation", "example", "exampleTranslation"):
            if not entry[field]:
                problems.append(f"{where}: empty {field}")
        if raw.get("cefr") and raw["cefr"] != level:
            problems.append(f"{where}: says level {raw['cefr']!r}, expected {level!r}")
        entries.append(entry)

    return entries, topics, problems


def main() -> int:
    parser = argparse.ArgumentParser(description=__doc__)
    parser.add_argument("--pdf", type=Path)
    parser.add_argument("--json", dest="json_path", type=Path, nargs="+")
    parser.add_argument("--level", required=True)
    parser.add_argument("--expect", type=int, default=0)
    parser.add_argument("--out", required=True, type=Path)
    args = parser.parse_args()

    if bool(args.pdf) == bool(args.json_path):
        raise SystemExit("give exactly one of --pdf or --json")
    for supplied in ([args.pdf] if args.pdf else args.json_path):
        if not supplied.exists():
            raise SystemExit(f"no such file: {supplied}")

    if args.pdf:
        entries, topics, problems = parse(args.pdf, args.level)
    else:
        entries, topics, problems = from_json(args.json_path, args.level)

    if args.expect and len(entries) != args.expect:
        problems.append(f"expected {args.expect} entries, found {len(entries)}")
    # A headword repeated with a *different* gloss is a homonym and legitimate:
    # ein Paar / ein paar, der Morgen / morgen, die Orange / orange. Only the
    # same word with the same meaning twice is an import fault. The key keeps
    # the printed capitalisation, because in German that is part of the word.
    seen: dict[tuple[str, str], str] = {}
    homonyms: list[str] = []
    for entry in entries:
        key = (entry["word"], entry["translation"].lower())
        if key in seen:
            problems.append(f"{entry['word']!r} = {entry['translation']!r} listed twice "
                            f"({seen[key]}, {entry['topic']})")
        seen[key] = entry["topic"]
    by_word: dict[str, list[str]] = {}
    for entry in entries:
        by_word.setdefault(entry["word"].lower(), []).append(
            f"{entry['article']} {entry['word']}".strip() + f" = {entry['translation']}")
    for word, senses in by_word.items():
        if len(senses) > 1:
            homonyms.append(" / ".join(senses))

    if problems:
        print(f"{len(problems)} problem(s) — nothing written:", file=sys.stderr)
        for problem in problems[:40]:
            print("  -", problem, file=sys.stderr)
        return 1

    args.out.write_text(json.dumps({
        "level": args.level,
        "source": f"German Vocabulary — Level {args.level} (clean rebuild, "
                  f"composed for this project)",
        "topics": topics,
        "entries": entries,
    }, ensure_ascii=False, indent=1) + "\n", encoding="utf-8")

    print(f"{args.level}: {len(entries)} entries in {len(topics)} topics -> {args.out}")
    if homonyms:
        print(f"  {len(homonyms)} headword(s) carry more than one sense, kept as separate cards:")
        for pair in homonyms:
            print("    -", pair)
    if REPAIRED:
        print(f"  {len(REPAIRED)} Czech heading(s) repaired after encoding loss: "
              + ", ".join(REPAIRED))
    return 0


if __name__ == "__main__":
    sys.exit(main())
