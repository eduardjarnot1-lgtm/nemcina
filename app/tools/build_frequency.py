#!/usr/bin/env python3
"""Build german/data/frequency.json from a FrequencyWords-style word list.

Usage:  python3 build_frequency.py <de_top2000_frequency.txt>
        python3 build_frequency.py --check

Input is the plain "<form> <count>" list published by the hermitdave/
FrequencyWords project, derived from the OpenSubtitles corpus. Output is the
same data as JSON with an explicit rank, plus a meta block that records what
the corpus is and what it is not.

WHAT THIS LIST IS
-----------------
A list of *word forms*, ordered by how often that exact string occurs in film
and television subtitles. It is not a lemma list: "ist", "sind" and "war" are
three separate entries and none of them is "sein". It is not a CEFR list
either, and it skews spoken and colloquial, because that is what subtitles are.

Both facts matter downstream, so they are written into the file rather than
left for a reader to assume: build_vocabulary.py matches on the printed
headword only, and the app labels every rank as subtitle frequency.
"""

from __future__ import annotations

import json
import re
import sys
from pathlib import Path

ROOT = Path(__file__).resolve().parent
OUT = ROOT.parent / "data" / "frequency.json"

SOURCE = "hermitdave/FrequencyWords — German (OpenSubtitles corpus)"
CORPUS_NOTE = (
    "Word forms ranked by frequency in film and television subtitles. This is a "
    "list of surface forms, not lemmas, and it skews spoken and colloquial "
    "German. It is not a CEFR list and implies nothing about level."
)

LINE = re.compile(r"^(\S+)\s+(\d+)\s*$")


def rank(forms: list[dict]) -> list[dict]:
    """Order by count and number the result, or refuse to.

    Shared by the build and by --check so the two cannot drift: a check that
    re-implements the rule it is checking eventually checks a different rule.
    """
    ordered = sorted(forms, key=lambda entry: (-entry["count"], entry["form"]))
    for number, entry in enumerate(ordered, start=1):
        entry["rank"] = number
    counts = [entry["count"] for entry in ordered]
    if counts != sorted(counts, reverse=True):
        raise SystemExit("ranking failed: counts are not monotonically decreasing")
    return ordered


def check() -> int:
    """Verify the committed frequency.json without the word list.

    The list this is built from is not in the repository, so the file cannot be
    regenerated on a runner. It was therefore the one piece of app/data that no
    check in CI ever looked at — a hand edit, a bad merge or a truncated write
    would have gone straight through.

    This does what can be done without the source: re-derive the ranks from the
    counts the file already carries and require the file to match, and re-count
    the meta block. It cannot tell you the counts are the ones the corpus
    published. It can tell you the file is internally what it claims to be.
    """
    if not OUT.exists():
        raise SystemExit(f"no such file: {OUT}")
    payload = json.loads(OUT.read_text(encoding="utf-8"))
    forms = payload.get("forms") or []
    if not forms:
        raise SystemExit(f"{OUT.name}: no forms")

    problems: list[str] = []
    seen: set[str] = set()
    for entry in forms:
        form = entry.get("form")
        if not isinstance(form, str) or not form:
            problems.append(f"an entry has no form: {entry!r}")
            continue
        if form in seen:
            problems.append(f"{form!r} appears twice; it should have been folded")
        seen.add(form)
        if not isinstance(entry.get("count"), int) or entry["count"] < 1:
            problems.append(f"{form!r} has an unusable count {entry.get('count')!r}")

    if not problems:
        # rank() mutates, so compare against a copy and let it raise on a
        # non-monotonic file exactly as it would during a build.
        expected = rank([dict(entry) for entry in forms])
        for was, should in zip(forms, expected):
            if was["form"] != should["form"] or was["rank"] != should["rank"]:
                problems.append(
                    f"rank {was['rank']} holds {was['form']!r}; "
                    f"by count it should hold {should['form']!r}")
                break
        meta = payload.get("meta") or {}
        if meta.get("formCount") != len(forms):
            problems.append(
                f"meta.formCount is {meta.get('formCount')!r}, the file has {len(forms)}")
        total = sum(entry["count"] for entry in forms)
        if meta.get("totalCount") != total:
            problems.append(f"meta.totalCount is {meta.get('totalCount')!r}, the counts sum to {total}")
        for field in ("source", "corpus", "note"):
            if not str(meta.get(field, "")).strip():
                problems.append(f"meta.{field} is empty; the provenance is the point of it")

    if problems:
        for problem in problems[:20]:
            print("  ERROR:", problem, file=sys.stderr)
        raise SystemExit(f"{OUT.name}: {len(problems)} problem(s)")
    print(f"frequency.json: {len(forms)} forms, ranks and tallies consistent")
    return 0


def main() -> int:
    if len(sys.argv) == 2 and sys.argv[1] == "--check":
        return check()
    if len(sys.argv) != 2:
        raise SystemExit(__doc__)
    path = Path(sys.argv[1])
    if not path.exists():
        raise SystemExit(f"no such file: {path}")

    forms: list[dict] = []
    seen: dict[str, int] = {}
    problems: list[str] = []

    for number, raw in enumerate(path.read_text(encoding="utf-8").splitlines(), start=1):
        line = raw.strip()
        if not line:
            continue
        match = LINE.match(line)
        if not match:
            problems.append(f"line {number}: cannot parse {line[:40]!r}")
            continue
        form, count = match.group(1).lower(), int(match.group(2))
        if form in seen:
            # The corpus can list the same form twice through casing; fold the
            # counts together rather than keeping a duplicate rank.
            forms[seen[form]]["count"] += count
            continue
        seen[form] = len(forms)
        forms.append({"form": form, "rank": 0, "count": count})

    if problems:
        for problem in problems[:20]:
            print("  ERROR:", problem, file=sys.stderr)
        raise SystemExit(f"{len(problems)} unparsable line(s); nothing written")
    if not forms:
        raise SystemExit("no entries read")

    forms = rank(forms)
    counts = [entry["count"] for entry in forms]

    payload = {
        "meta": {
            "language": "de",
            "source": SOURCE,
            "corpus": "OpenSubtitles",
            "note": CORPUS_NOTE,
            "formCount": len(forms),
            "totalCount": sum(counts),
        },
        "forms": forms,
    }
    OUT.parent.mkdir(parents=True, exist_ok=True)
    OUT.write_text(json.dumps(payload, ensure_ascii=False, indent=1), encoding="utf-8")
    print(f"forms {len(forms)} -> {OUT}")
    print(f"  most frequent: {', '.join(e['form'] for e in forms[:8])}")
    print(f"  least frequent kept: {forms[-1]['form']} ({forms[-1]['count']})")
    return 0


if __name__ == "__main__":
    sys.exit(main())
