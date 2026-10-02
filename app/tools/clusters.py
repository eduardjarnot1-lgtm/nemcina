"""
Lesson clusters — cutting a topic into lessons that are *about* something.

The vocabulary already carries a level and a topic, and that was not enough. A
topic like A2 "travel" holds sixty-one words, and the lesson builder cut it into
four slices in teaching order. Teaching order is level, then frequency, then the
word itself — and almost nothing in a topic list is frequency-ranked, so in
practice those slices came out alphabetical. "Travel, lesson 1" ran Hotel to
Autobahn; the airport words were spread across all four, with Flughafen in the
first and Sicherheitskontrolle in the last. Every lesson was nominally about
travel and none was about anything.

A cluster is the missing level: level -> category -> subcategory -> cluster.
Clusters are assigned here, at build time, and written into the data. Nothing
decides at runtime what belongs with what (that would be a model call on the
path to opening a lesson, and a different answer each time).

How a word finds its cluster
----------------------------
A lexicon of semantic *fields* lives beside this file. A field is a name and a
bag of evidence: German stems that appear in the word itself, and English
keywords that appear in its gloss. `Flughafen` matches the airport field on the
stem `flug`; `to board` matches it on the gloss.

German is unusually good to do this to. It builds compounds, so the semantic
head is inside the word: Flug-hafen, Flug-zeug, Flug-ticket, Ab-flug all carry
`flug`. A stem test on a folded headword is therefore not a crude heuristic
here, it is reading the language's own morphology.

Two rules keep it honest:

  - A word is scored against every field its subcategory allows and takes the
    best. Ties go to the earlier field in the lexicon, so the result does not
    depend on dictionary ordering.
  - Word families are kept together afterwards. `fliegen` matches no airport
    stem on its own, but `Flug`, `Flugzeug` and `Abflug` do, and a learner meets
    them as one family or not at all.

What is left over is not forced. A word that matches nothing stays in its
subcategory's residual cluster, which is a real lesson with an honest name
rather than a bin called "Other". The validation report counts those, because
the number of words that found no field is the measure of how good this lexicon
is, and it should be visible rather than buried.
"""

from __future__ import annotations

import json
import re
import unicodedata
from collections import Counter, OrderedDict, defaultdict
from pathlib import Path

LEXICON = Path(__file__).resolve().parent / "annotations" / "vocabulary" / "clusters.json"

# A cluster should be one sitting's worth of related words. Below MIN it is not
# a lesson, it is a fragment, and it gets folded back into the residual; above
# MAX it stops being focused and is cut into numbered parts.
MIN_CLUSTER = 6
MAX_CLUSTER = 20

# Stems shorter than this match far too much: "ei" is inside "Arbeit", "Freiheit"
# and "zwei". Short seeds are still allowed, but only as whole words.
STEM_MIN = 4


def fold(text: str) -> str:
    """Lowercase, strip the parenthetical gloss, and flatten German spelling.

    `Karte (Stadtplan)` and `einchecken (Hotel)` carry a disambiguating note in
    brackets that is not part of the word; it would otherwise match stems that
    the headword itself does not contain.
    """
    text = re.sub(r"\([^)]*\)", " ", str(text))
    text = text.lower().replace("ß", "ss")
    text = unicodedata.normalize("NFD", text)
    text = "".join(c for c in text if unicodedata.category(c) != "Mn")
    return re.sub(r"[^a-z0-9]+", " ", text).strip()


def _words(folded: str) -> list[str]:
    return [w for w in folded.split() if w]


def qualifier(term: str) -> str:
    """The disambiguating note in brackets, folded.

    `einchecken (Hotel)` and `Karte (Landkarte)` carry the sense the compiler
    meant in the bracket. `fold` drops it, correctly, because it is not part of
    the German being taught — but it is the single best piece of evidence about
    which field the word belongs to, so it is read separately and weighed above
    everything else.
    """
    found = re.findall(r"\(([^)]*)\)", str(term))
    return fold(" ".join(found)) if found else ""


class Lexicon:
    """The semantic fields, and which subcategories each may claim a word in."""

    def __init__(self, raw: dict):
        self.fields: list[dict] = []
        for order, field in enumerate(raw.get("fields", [])):
            self.fields.append({
                "id": field["id"],
                "name": field["name"],
                "blurb": field.get("blurb", ""),
                "order": order,
                "stems": [fold(s) for s in field.get("stems", []) if fold(s)],
                "gloss": [fold(s) for s in field.get("gloss", []) if fold(s)],
                "applies": set(field.get("appliesTo", [])),
                # Fields in a group are near neighbours. When one is too small
                # to be a lesson on its own in some bucket, it joins its
                # neighbours rather than falling into the residual.
                "group": field.get("group", ""),
            })
        self.groups: dict[str, str] = raw.get("groups", {})
        self.residual_names: dict[str, str] = raw.get("residualNames", {})
        # Subcategories that are already one tight topic. "Verb + noun
        # collocations" has no finer semantic structure to find — every word in
        # it is the same kind of thing — so looking for fields inside it would
        # invent distinctions the language does not make. These are cut into
        # teachable portions instead, in the order the source teaches them.
        self.cohesive: dict[str, str] = raw.get("cohesiveSubcategories", {})

    def for_subcategory(self, sub_id: str) -> list[dict]:
        # An empty `appliesTo` means the field is general and may claim a word in
        # any subcategory; a listed one means it was written for those topics.
        return [f for f in self.fields if not f["applies"] or sub_id in f["applies"]]


def score(word: dict, field: dict) -> int:
    """How much evidence this field has for this word.

    The headword counts for more than the gloss because it is the German being
    taught; the gloss is a translation choice and two synonyms may be glossed
    the same way.
    """
    raw_term = word.get("term") or word.get("word", "")
    term = fold(raw_term)
    gloss = fold(word.get("translation", ""))
    term_words = _words(term)
    gloss_words = set(_words(gloss))
    note = qualifier(raw_term)
    note_words = set(_words(note))

    points = 0
    # The bracket wins ties against the headword: `einchecken (Hotel)` is a
    # hotel word that happens to share a verb with the airport.
    if note:
        for stem in field["stems"]:
            if (stem in note) if len(stem) >= STEM_MIN else (stem in note_words):
                points += 4
        for key in field["gloss"]:
            if (key in note) if " " in key else (key in note_words):
                points += 4
    for stem in field["stems"]:
        if len(stem) >= STEM_MIN:
            # Compound-aware: the stem may sit anywhere inside the headword.
            if stem in term:
                points += 3
        elif stem in term_words:
            points += 3
    for key in field["gloss"]:
        if " " in key:
            if key in gloss:
                points += 2
        elif key in gloss_words:
            points += 2
    return points


def family_key(term: str) -> str:
    """A crude stem for grouping word families.

    Only ever used to keep relatives together once one of them has been placed,
    never to invent a relationship on its own — so being approximate is safe
    here in a way it would not be if it decided meaning.
    """
    head = _words(fold(term))
    if not head:
        return ""
    stem = max(head, key=len)
    for suffix in ("ungen", "ung", "heit", "keit", "chen", "lein", "isch", "lich",
                   "en", "er", "es", "e", "n", "s"):
        if len(stem) - len(suffix) >= 5 and stem.endswith(suffix):
            return stem[: -len(suffix)]
    return stem


def _split_keeping_families(words: list[dict]) -> list[list[dict]]:
    """Cut an over-long cluster into parts without separating relatives.

    Families move as a unit, so `fliegen`, `Flug` and `Flugzeug` cannot end up
    in different lessons just because the cut landed between them.
    """
    if len(words) <= MAX_CLUSTER:
        return [words]
    parts = max(2, -(-len(words) // MAX_CLUSTER))
    target = -(-len(words) // parts)

    groups: "OrderedDict[str, list[dict]]" = OrderedDict()
    for word in words:
        groups.setdefault(family_key(word["term"]) or word["id"], []).append(word)

    out: list[list[dict]] = [[]]
    for group in groups.values():
        # A family bigger than a whole lesson cannot be kept together; cut it
        # rather than ship a cluster nobody can finish. (Keeping relatives
        # together is a preference, the ceiling is a rule.)
        if len(group) > MAX_CLUSTER:
            for start in range(0, len(group), MAX_CLUSTER):
                if out[-1]:
                    out.append([])
                out[-1].extend(group[start:start + MAX_CLUSTER])
            continue
        over_target = out[-1] and len(out[-1]) + len(group) > target and len(out) < parts
        over_ceiling = out[-1] and len(out[-1]) + len(group) > MAX_CLUSTER
        if over_target or over_ceiling:
            out.append([])
        out[-1].extend(group)
    return [part for part in out if part]


def assign(
    words: list[dict], lexicon: Lexicon, sub_id: str, sub_name: str = "",
) -> tuple[dict[str, str], list[dict]]:
    """Place one (level, subcategory) bucket's words into clusters.

    Returns the word id -> field id map and the ordered cluster descriptions.
    """
    label = sub_name or sub_id

    if sub_id in lexicon.cohesive:
        name = lexicon.cohesive[sub_id]
        parts = _split_keeping_families(list(words))
        clusters = [{
            "field": "topic",
            "name": name if len(parts) == 1 else f"{name} {i}",
            "blurb": "",
            "part": i,
            "words": part,
        } for i, part in enumerate(parts, 1)]
        return {w["id"]: "topic" for w in words}, clusters

    fields = lexicon.for_subcategory(sub_id)
    chosen: dict[str, dict | None] = {}

    for word in words:
        best, best_score = None, 0
        for field in fields:
            points = score(word, field)
            # Strictly greater, so a tie leaves the earlier field in place and
            # the outcome does not depend on lexicon ordering accidents.
            if points > best_score:
                best, best_score = field, points
        chosen[word["id"]] = best

    # Word families: a relative of a placed word belongs with it. Only unplaced
    # words are moved, so this can add a connection but never override one the
    # evidence already made.
    families: dict[str, list[dict]] = defaultdict(list)
    for word in words:
        key = family_key(word["term"])
        if key:
            families[key].append(word)
    for members in families.values():
        if len(members) < 2:
            continue
        votes = Counter(
            chosen[m["id"]]["id"] for m in members if chosen[m["id"]] is not None
        )
        if not votes:
            continue
        winner_id, _ = votes.most_common(1)[0]
        winner = next(f for f in fields if f["id"] == winner_id)
        for member in members:
            if chosen[member["id"]] is None:
                chosen[member["id"]] = winner

    # Gather by field, in lexicon order, with the unmatched kept aside.
    by_field: "OrderedDict[str, list[dict]]" = OrderedDict()
    for field in sorted(fields, key=lambda f: f["order"]):
        by_field[field["id"]] = []
    residual: list[dict] = []
    for word in words:
        field = chosen[word["id"]]
        if field is None:
            residual.append(word)
        else:
            by_field[field["id"]].append(word)

    # A handful of words is not a lesson. But folding every fragment into the
    # residual rebuilds the "Other" bin this whole file exists to avoid, so an
    # undersized field first tries its neighbours: five booking words and five
    # driving words are not two lessons, they are one lesson about getting
    # around. Only what has no neighbour left falls through.
    fields_by_id = {f["id"]: f for f in fields}
    by_group: "OrderedDict[str, list[str]]" = OrderedDict()
    for field_id, bucket in by_field.items():
        if 0 < len(bucket) < MIN_CLUSTER:
            field = next(f for f in fields if f["id"] == field_id)
            by_group.setdefault(field["group"], []).append(field_id)

    merged: list[dict] = []
    for group_id, field_ids in by_group.items():
        pooled = [w for fid in field_ids for w in by_field[fid]]
        if group_id and len(pooled) >= MIN_CLUSTER:
            # Keep each small field's words adjacent inside the merged lesson.
            first = min(next(f for f in fields if f["id"] == fid)["order"] for fid in field_ids)
            # Name it after the field that actually dominates it, falling back
            # to the group only when no single field does. A group name is
            # written for the group's home topic, so using it unconditionally
            # labelled an A2 *restaurant* lesson about reserving a table
            # "Getting around & booking" — the words were right and the heading
            # came from travel.
            biggest = max(field_ids, key=lambda fid: (len(by_field[fid]), -fields_by_id[fid]["order"]))
            name = (fields_by_id[biggest]["name"]
                    if len(by_field[biggest]) * 10 >= len(pooled) * 6
                    else lexicon.groups.get(group_id, group_id))
            merged.append({
                "id": group_id,
                "name": name,
                "order": first,
                "words": pooled,
            })
        else:
            residual.extend(pooled)
        for fid in field_ids:
            by_field[fid] = []
    residual.sort(key=lambda w: w["id"])

    emit: list[tuple[int, str, str, str, list[dict]]] = []
    for field in sorted(fields, key=lambda f: f["order"]):
        bucket = by_field[field["id"]]
        if bucket:
            emit.append((field["order"], field["id"], field["name"], field["blurb"], bucket))
    for group in merged:
        emit.append((group["order"], group["id"], group["name"], "", group["words"]))
    emit.sort(key=lambda e: e[0])

    clusters: list[dict] = []
    for _, field_id, field_name, blurb, bucket in emit:
        for index, part in enumerate(_split_keeping_families(bucket), 1):
            clusters.append({
                "field": field_id,
                "name": field_name if index == 1 and len(bucket) <= MAX_CLUSTER
                        else f"{field_name} {index}",
                "blurb": blurb,
                "part": index,
                "words": part,
            })
    if residual:
        # Named for the topic they came from rather than binned as "Other". The
        # source lists run in thematic blocks — B2 economy moves from company
        # basics through the business cycle to trade policy — and `residual` is
        # still in that order, so these parts hold together more than the name
        # admits.
        name = lexicon.residual_names.get(sub_id) or label
        residual_parts = _split_keeping_families(residual)
        for index, part in enumerate(residual_parts, 1):
            clusters.append({
                "field": "general",
                "name": name if len(residual_parts) == 1 else f"{name} {index}",
                "blurb": "",
                "part": index,
                "words": part,
            })
    placed: dict[str, str] = {}
    for cluster in clusters:
        for word in cluster["words"]:
            placed[word["id"]] = cluster["field"]
    return placed, clusters


def load_lexicon() -> Lexicon:
    if not LEXICON.exists():
        return Lexicon({"fields": []})
    return Lexicon(json.loads(LEXICON.read_text(encoding="utf-8")))


def primary_placement(word: dict) -> dict:
    """The topic a word is filed under for teaching purposes.

    A word can carry several topics; the first non-level one is always the list
    it was *taught* from, at its own level (the builder writes it that way and
    `validate_content` enforces it). The later ones are cross-references from
    other levels' lists, and clustering a word by one of those would file an A1
    word inside a B2 lesson.
    """
    for placement in word.get("categories", []):
        if placement.get("category") != "levels":
            return placement
    return {"category": "", "subcategory": ""}


def cluster_database(
    words: list[dict], lexicon: Lexicon, sub_names: dict[str, str] | None = None,
) -> tuple[list[dict], dict[str, str]]:
    """Cluster every word in the database.

    Returns the cluster records and a word id -> cluster id map. Buckets are
    processed in a fixed order and ids are built from level, subcategory and
    field, so the same input always produces the same output — the build is
    diffed in CI and a clustering that reshuffled itself would fail that.
    """
    sub_names = sub_names or {}
    buckets: "OrderedDict[tuple[str, str, str], list[dict]]" = OrderedDict()
    for word in words:
        placement = primary_placement(word)
        key = (word["level"], placement["category"], placement["subcategory"])
        buckets.setdefault(key, []).append(word)

    records: list[dict] = []
    membership: dict[str, str] = {}

    for (level, category, sub_id), bucket in buckets.items():
        _, assigned = assign(bucket, lexicon, sub_id, sub_names.get(sub_id, ""))
        for order, cluster in enumerate(assigned):
            suffix = f"-p{cluster['part']}" if cluster["part"] > 1 else ""
            cluster_id = f"{level.lower()}-{sub_id}-{cluster['field']}{suffix}"
            records.append({
                "id": cluster_id,
                "level": level,
                "category": category,
                "subcategory": sub_id,
                "field": cluster["field"],
                "name": cluster["name"],
                "blurb": cluster["blurb"],
                "order": order,
                "wordCount": len(cluster["words"]),
                # The first few headwords, so a lesson card can say what is in
                # it without the learner having to open it.
                "preview": [w["term"] for w in cluster["words"][:3]],
                "itemIds": [w["id"] for w in cluster["words"]],
            })
            for word in cluster["words"]:
                membership[word["id"]] = cluster_id

    return records, membership
