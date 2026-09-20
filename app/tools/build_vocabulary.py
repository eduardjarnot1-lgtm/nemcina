#!/usr/bin/env python3
"""Build app/data/vocabulary.json from the clean-rebuild word lists.

What changed and why
--------------------
The corpus used to be the OCR GCSE exam-board list, levelled against the
Goethe-Institut Wortlisten and the Lingster A1-B2 list, with English glosses
filled in from the Ding dictionary. That was accurate and it was carefully
attributed, and every one of those sources belongs to somebody else — which
made vocabulary the project's first release blocker.

It is now built from four lists composed for this project instead:

    clean-a1-source.json    600 entries, 12 topics
    clean-a2-source.json    900 entries, 15 topics
    clean-b1-source.json  1 000 entries, 18 topics
    b2-vocabulary-source.json  500 entries, 25 topics

Every entry carries its own English gloss, an example sentence and that
sentence's translation, so nothing has to be borrowed from a dictionary and
nothing is inferred. The word-frequency ranks stay: that corpus is openly
licensed and only attaches a number to a word already in the list.

The rules that survive from the old build, because they were never about the
old sources:

  * A word sits at the **lowest** level any list assigns it. A word taught at
    A1 is an A1 word even when a later list repeats it.
  * The same headword with a **different** meaning is a homonym and gets its
    own card — der Morgen and morgen are not one word.
  * Nothing is invented. A part of speech is used when a list states one and
    derived only from what the entry prints otherwise.
"""

from __future__ import annotations

import json
import re
import sys
import unicodedata
from collections import Counter, OrderedDict
from pathlib import Path

ROOT = Path(__file__).resolve().parent
DATA_OUT = ROOT.parent / "data" / "vocabulary.json"
FREQUENCY = ROOT.parent / "data" / "frequency.json"

SOURCE_TITLE = "German Vocabulary A1-B2 (clean rebuild, composed for this project)"
SOURCE_NOTE = (
    "Every word, gloss and example sentence in this app was composed for it. "
    "Nothing is taken from an exam board's list, a publisher's word list or a "
    "dictionary, so the vocabulary carries no third-party licensing question."
)
CEFR_NOTE = (
    "Each list states the level of the words it contains. A word that appears "
    "in more than one list is filed at the lowest of them."
)

LEVELS_ORDER = ["A1", "A2", "B1", "B2", "C1"]
LEVEL_EMOJI = {"A1": "\U0001F331", "A2": "\U0001F33F", "B1": "\U0001F333",
               "B2": "\U0001F332", "C1": "\U0001F5FB"}

# level -> (source file, category id, category name, category emoji)
SOURCES = [
    ("A1", "clean-a1-source.json", "a1topics", "A1 topics", "\U0001F331"),
    ("A2", "clean-a2-source.json", "a2topics", "A2 topics", "\U0001F33F"),
    ("B1", "clean-b1-source.json", "b1topics", "B1 topics", "\U0001F333"),
    ("B2", "b2-vocabulary-source.json", "b2topics", "B2 topics", "\U0001F332"),
    # A second B2 list, written for this project like the others. The two are
    # almost disjoint — 14 headwords in common out of 1 986 — so both are kept
    # and the overlap merges the way any repeat across lists does. They share a
    # category id on purpose: a learner browsing B2 should see one B2, not two
    # lists that happen to have arrived separately.
    ("B2", "clean-b2-source.json", "b2topics", "B2 topics", "\U0001F332"),
    ("C1", "clean-c1-source.json", "c1topics", "C1 topics", "\U0001F5FB"),
]

WORD_TYPES = [
    ("noun", "Nouns", "\U0001F9E9"),
    ("verb", "Verbs", "⚡"),
    ("adjective", "Adjectives", "\U0001F3A8"),
    ("adverb", "Adverbs", "\U0001F9ED"),
    ("pronoun", "Pronouns", "\U0001F464"),
    ("preposition", "Prepositions", "\U0001F4CD"),
    ("conjunction", "Conjunctions", "\U0001F517"),
    ("other", "Other useful vocabulary", "✨"),
]
VALID_TYPES = {t[0] for t in WORD_TYPES}

# Three of the B2 headings name a word class outright, so those entries are
# typed from the document. Every other heading names a subject area.
B2_TOPIC_TYPES = {
    "Abstrakte Substantive": "noun",
    "Komplexe Verben": "verb",
    "Erweiterte Adjektive": "adjective",
}

# The B2 list prints German headings; the others print Czech with an English
# label beside it. The app shows English throughout, so the B2 headings get the
# same treatment here: the label is this project's translation of the heading.
B2_TOPIC_LABELS = {
    "Arbeit & Beruf": "Work and career", "Bildung": "Education",
    "Gesundheit": "Health", "Umwelt": "Environment", "Gesellschaft": "Society",
    "Politik": "Politics", "Wirtschaft": "Economy", "Technologie": "Technology",
    "Medien": "Media", "Reisen & Kultur": "Travel and culture",
    "Beziehungen & Gefühle": "Relationships and feelings",
    "Meinung & Diskussion": "Opinion and discussion", "Wissenschaft": "Science",
    "Recht": "Law", "Natur & Tiere": "Nature and animals",
    "Wohnen & Alltag": "Home and everyday life", "Kunst & Literatur": "Art and literature",
    "Sport & Freizeit": "Sport and leisure", "Charaktereigenschaften": "Character traits",
    "Abstrakte Substantive": "Abstract nouns", "Komplexe Verben": "Complex verbs",
    "Erweiterte Adjektive": "Advanced adjectives", "Zeit & Veränderung": "Time and change",
    "Kommunikation": "Communication", "Probleme & Lösungen": "Problems and solutions",
}

# Decoration only, keyed by the English label each list prints.
TOPIC_EMOJI = {
    "Greetings & introductions": "\U0001F44B", "Family": "\U0001F46A", "Numbers": "\U0001F522",
    "Time & date": "\U0001F552", "Colors": "\U0001F3A8", "Food & drink": "\U0001F37D️",
    "Housing": "\U0001F3E0", "School": "\U0001F3EB", "Work": "\U0001F4BC",
    "Free time": "\U0001F3AE", "Weather": "\U0001F326️", "City & transport": "\U0001F68C",
    "Shopping": "\U0001F6D2", "Restaurant": "\U0001F374", "Travel": "✈️",
    "Vacation": "\U0001F3D6️", "Health & body": "\U0001FA7A", "Clothing": "\U0001F455",
    "Household": "\U0001F9F9", "Relationships": "❤️", "Sport": "⚽", "Culture": "\U0001F3AD",
    "Nature": "\U0001F333", "Communication": "\U0001F4AC", "Services": "\U0001F6CE️",
    "Work & professions": "\U0001F454", "Everyday problems": "\U0001F9E9",
    "Education": "\U0001F393", "Working life": "\U0001F4BC", "Media": "\U0001F4F0",
    "Technology": "\U0001F4BB", "Environment": "\U0001F30D",
    "Interpersonal relationships": "\U0001F91D", "Emotions": "\U0001F60A",
    "Healthy lifestyle": "\U0001F957", "Society": "\U0001F465", "Finance": "\U0001F4B0",
    "Opinions and argumentation": "⚖️",
    "Work and career": "\U0001F4BC", "Health": "\U0001FA7A", "Politics": "\U0001F3DB️",
    "Economy": "\U0001F4C8", "Travel and culture": "\U0001F9F3",
    "Relationships and feelings": "❤️", "Opinion and discussion": "\U0001F4AC",
    "Science": "\U0001F52C", "Law": "⚖️", "Nature and animals": "\U0001F333",
    "Home and everyday life": "\U0001F3E1", "Art and literature": "\U0001F3A8",
    "Sport and leisure": "⚽", "Character traits": "\U0001F9ED", "Abstract nouns": "\U0001F4AD",
    "Complex verbs": "⚡", "Advanced adjectives": "\U0001F3AF", "Time and change": "⏳",
    "Problems and solutions": "\U0001F9E9",
}
DEFAULT_TOPIC_EMOJI = "\U0001F4D8"


def slug(text: str) -> str:
    folded = unicodedata.normalize("NFKD", text).encode("ascii", "ignore").decode()
    return re.sub(r"-+", "-", re.sub(r"[^a-z0-9]+", "-", folded.lower())).strip("-")


def level_placement(level: str) -> dict:
    return {"category": "levels", "subcategory": level.lower(), "tier": "", "page": 0}


def word_type(entry: dict, level: str) -> str:
    """What the list says, and only what it says.

    An article makes a noun. Three B2 headings name a word class for their
    entries. An English gloss that begins with "to " is the list calling the
    entry a verb. Anything else is left unclassified rather than guessed at —
    a wrong part of speech on a card teaches a wrong thing.
    """
    stated = (entry.get("type") or "").strip()
    if stated in VALID_TYPES:
        return stated
    if entry.get("article"):
        return "noun"
    if level == "B2":
        declared = B2_TOPIC_TYPES.get(entry.get("topic", ""))
        if declared:
            return declared
    if entry.get("translation", "").startswith("to "):
        return "verb"
    return "other"


def topic_label(entry: dict, level: str) -> tuple[str, str]:
    """(English label, the heading the document itself prints)."""
    printed = entry.get("topic", "")
    if level == "B2":
        return B2_TOPIC_LABELS.get(printed, printed), printed
    return printed, entry.get("topicCzech", "") or printed


def senses(gloss: str) -> set[str]:
    """The distinct meanings a gloss lists: "training / workout" is two.

    A parenthetical is a note on a sense, not a sense of its own, so it is
    dropped for the comparison only — "police officer (male)" and "police
    officer" are the same meaning of the same word. The gloss a card shows is
    never changed by this.
    """
    out = set()
    for part in gloss.split("/"):
        bare = re.sub(r"\([^)]*\)", " ", part)
        bare = re.sub(r"\s+", " ", bare).strip().lower()
        if bare:
            out.add(bare)
    return out


def merge_same_word(word_list: list[dict]) -> tuple[list[dict], int]:
    """Fold a word two lists teach with slightly different wording into one card.

    An exact repeat is already merged while reading. This catches the rest: the
    B1 list glosses sich versöhnen as "to reconcile / make up" and the B2 list
    as "to reconcile". Those are one word, and two cards for it would ask a
    learner the same question twice and split its progress in half.

    A shared sense is required, and so are the article and the part of speech —
    which is what keeps real homonyms apart. die Orange and orange share a
    spelling and nothing else: different article, different word class, and the
    glosses "orange (fruit)" and "orange" name different things.
    """
    keep: list[dict] = []
    # A list per key, not one card per key. Three lists can teach one word: an
    # earlier build compared each new card only against the most recent one
    # with the same key, so a card that failed to merge replaced the card
    # before it and hid it from everything after. With abwägen taught at B1,
    # B2 and C1 that lost a real merge — B1 "to weigh up" and C1 "to weigh up /
    # consider carefully" never met, because the B2 gloss sat between them and
    # shares a sense with neither.
    by_word: dict[tuple[str, str, str], list[dict]] = {}
    merged = 0
    for word in word_list:
        key = (word["word"], word["article"], word["type"])
        earlier = by_word.setdefault(key, [])
        target = next(
            (card for card in earlier
             if senses(card["translation"]) & senses(word["translation"])),
            None,
        )
        if target is not None:
            for placement in word["categories"]:
                if placement not in target["categories"]:
                    target["categories"].append(placement)
            # Keep whichever gloss names more senses; it is the more useful card
            # and neither list is more authoritative than the other.
            if len(senses(word["translation"])) > len(senses(target["translation"])):
                target["translation"] = word["translation"]
            merged += 1
            continue
        earlier.append(word)
        keep.append(word)
    return keep, merged


def load_sources() -> list[tuple[str, str, dict]]:
    loaded = []
    for level, filename, category, name, emoji in SOURCES:
        path = ROOT / filename
        if not path.exists():
            raise SystemExit(f"missing {filename} — run the extractor for {level} first")
        payload = json.loads(path.read_text(encoding="utf-8"))
        loaded.append((level, category, {
            "name": name, "emoji": emoji, "entries": payload["entries"],
            "source": payload.get("source", ""),
        }))
    return loaded


def frequency_index() -> tuple[dict, dict]:
    """Ranks from an openly licensed subtitle corpus, matched on the printed
    headword and nothing else. A card that does not match simply has no rank."""
    if not FREQUENCY.exists():
        return {}, {}
    payload = json.loads(FREQUENCY.read_text(encoding="utf-8"))
    return {entry["form"]: entry for entry in payload["forms"]}, payload["meta"]


def main() -> int:
    sources = load_sources()

    words: "OrderedDict[tuple[str, str], dict]" = OrderedDict()
    categories: "OrderedDict[str, dict]" = OrderedDict()
    counts = Counter()
    repeats = 0

    for level, category_id, spec in sources:
        categories.setdefault(category_id, {
            "id": category_id, "name": spec["name"], "emoji": spec["emoji"],
            "subcategories": OrderedDict(),
        })
        for entry in spec["entries"]:
            head = entry["word"].strip()
            english, printed = topic_label(entry, level)
            sub_id = slug(english) or slug(printed)
            categories[category_id]["subcategories"].setdefault(sub_id, {
                "id": sub_id, "name": english or printed,
                "documentName": printed,
                "emoji": TOPIC_EMOJI.get(english, DEFAULT_TOPIC_EMOJI),
            })
            placement = {"category": category_id, "subcategory": sub_id, "tier": level, "page": 0}

            # The printed capitalisation is part of the German word, so it stays
            # in the key: ein Paar and ein paar are two words, not one.
            key = (head, entry["translation"].strip().lower())
            existing = words.get(key)
            if existing is not None:
                # Already taught at an earlier level. Keep that level and add
                # this list's topic, so the word is findable under both.
                if placement not in existing["categories"]:
                    existing["categories"].append(placement)
                repeats += 1
                continue

            counts[level] += 1
            words[key] = {
                "id": "",
                "language": "de",
                "level": level,
                "cefr": level,
                "cefrApprox": level,
                "cefrSource": "clean-list",
                "source": SOURCE_TITLE,
                "sourcePage": 0,
                "regionalVariant": "",
                "pluralForm": "",
                "verbForms": {},
                "word": head,
                "term": head,
                "variants": "",
                "translation": entry["translation"].strip(),
                "translationSource": "clean-list",
                "type": word_type(entry, level),
                "article": entry.get("article", ""),
                "plural": False,
                "example": entry.get("example", "").strip(),
                "exampleTranslation": entry.get("exampleTranslation", "").strip(),
                # The example comes from the card's own list, so there is
                # nothing extra to attribute.
                "exampleSource": "",
                "note": "",
                "needsReview": False,
                "categories": [level_placement(level), placement],
            }

    word_list, merged_wording = merge_same_word(list(words.values()))
    for index, word in enumerate(word_list, 1):
        word["id"] = f"w{index:04d}"

    frequency, frequency_meta = frequency_index()
    ranked = 0
    heads = Counter(w["word"].lower() for w in word_list)
    for word in word_list:
        entry = frequency.get(word["word"].lower())
        word["frequencyRank"] = entry["rank"] if entry else 0
        word["frequencyCount"] = entry["count"] if entry else 0
        # The corpus is case-folded, so two cards spelled alike share one count.
        word["frequencyShared"] = bool(entry) and heads[word["word"].lower()] > 1
        if entry:
            ranked += 1

    category_list = [
        {"id": c["id"], "name": c["name"], "emoji": c["emoji"],
         "subcategories": list(c["subcategories"].values())}
        for c in categories.values()
    ]
    category_list.append({
        "id": "levels", "name": "By level", "emoji": "\U0001F4C8",
        "subcategories": [
            {"id": level.lower(), "name": f"{level} vocabulary",
             "documentName": level, "emoji": LEVEL_EMOJI[level]}
            for level in LEVELS_ORDER
            if any(w["cefr"] == level for w in word_list)
        ],
    })

    database = {
        "meta": {
            "language": "de",
            "source": SOURCE_TITLE,
            "sourceNote": SOURCE_NOTE,
            "level": "A1-B2",
            "cefrNote": CEFR_NOTE,
            "wordCount": len(word_list),
            "sourceEntryCount": sum(len(s[2]["entries"]) for s in sources),
            "frequency": {
                "source": frequency_meta.get("source", ""),
                "note": frequency_meta.get("note", ""),
                "formCount": frequency_meta.get("formCount", 0),
                "rankedWords": ranked,
            } if frequency_meta else None,
            "cefr": {
                "sources": [s[2]["source"] for s in sources],
                "note": CEFR_NOTE,
                "levelCounts": {level: sum(1 for w in word_list if w["cefr"] == level)
                                for level in LEVELS_ORDER},
                "levelledWords": len(word_list),
                "approximatedWords": 0,
                "importedWords": len(word_list),
            },
        },
        "wordTypes": [{"id": i, "name": n, "emoji": e} for i, n, e in WORD_TYPES],
        "categories": category_list,
        "words": word_list,
    }

    DATA_OUT.parent.mkdir(parents=True, exist_ok=True)
    DATA_OUT.write_text(json.dumps(database, ensure_ascii=False, indent=1), encoding="utf-8")

    print(f"source entries : {database['meta']['sourceEntryCount']}")
    print(f"words written  : {len(word_list)}  -> {DATA_OUT}")
    final = Counter(w["cefr"] for w in word_list)
    print(f"                 " + " · ".join(f"{k} {final[k]}" for k in LEVELS_ORDER))
    print(f"repeats merged : {repeats} exact, {merged_wording} worded differently "
          f"— all already taught at an earlier level")
    print(f"types          : " + " · ".join(
        f"{k} {v}" for k, v in Counter(w['type'] for w in word_list).most_common()))
    if frequency_meta:
        print(f"frequency rank : {ranked} of {len(word_list)} words matched a listed form")
    else:
        print("frequency rank : skipped — data/frequency.json not built")
    return 0


if __name__ == "__main__":
    sys.exit(main())
