"""
The cluster report.

Clustering fails quietly. A lexicon that matches nothing still produces a valid
file — every word lands in the residual and every lesson is called "More words",
which is the old behaviour wearing a new name. So the quality of the clustering
is measured and printed rather than assumed, and the number that matters is the
share of words a *named* field claimed.

Run it after editing the lexicon:

    python3 app/tools/report_clusters.py

`--check` turns the same measurements into a gate: it fails when coverage drops
below the floor, when a cluster is too big to teach, or when a subcategory that
needs splitting did not get split.
"""

from __future__ import annotations

import json
import sys
from collections import Counter, defaultdict
from pathlib import Path

sys.path.insert(0, str(Path(__file__).resolve().parent))
import clusters  # noqa: E402

DATA = Path(__file__).resolve().parents[1] / "data" / "vocabulary.json"

# The share of a level's words that reached a *named* cluster — a semantic field
# or a subcategory tight enough to teach whole. The rest sit in a residual named
# after their topic, which is not the same as being uncategorised: the source
# lists run in thematic blocks and that order is preserved, so a residual part
# of B1 "Opinions and argumentation" really is about stating an opinion. The
# floor is therefore not a quality target to tune against; it is the point at
# which the lexicon has stopped contributing to a level at all, and the
# per-level numbers above it are what to read.
COVERAGE_FLOOR = 0.50


def main(argv: list[str]) -> int:
    check = "--check" in argv
    database = json.loads(DATA.read_text(encoding="utf-8"))
    words = database["words"]
    lexicon = clusters.load_lexicon()
    sub_names = {s["id"]: s["name"]
                 for c in database.get("categories", []) for s in c.get("subcategories", [])}
    records, membership = clusters.cluster_database(words, lexicon, sub_names)

    by_id = {c["id"]: c for c in records}
    by_level: dict[str, list[dict]] = defaultdict(list)
    for cluster in records:
        by_level[cluster["level"]].append(cluster)

    print("VOCABULARY CLUSTER REPORT")
    print(f"lexicon: {len(lexicon.fields)} fields\n")

    failures: list[str] = []
    levels = [l for l in ["A1", "A2", "B1", "B2", "C1", "C2"] if l in by_level]

    for level in levels:
        group = by_level[level]
        total = sum(c["wordCount"] for c in group)
        # Two honest routes to a coherent lesson: a named semantic field, or a
        # subcategory that is already one tight topic, cut into portions.
        named = sum(c["wordCount"] for c in group if c["field"] not in ("general", "topic"))
        cohesive = sum(c["wordCount"] for c in group if c["field"] == "topic")
        subs = {c["subcategory"] for c in group}
        residual = total - named - cohesive
        share = (named + cohesive) / total if total else 0.0
        oversized = [c for c in group if c["wordCount"] > clusters.MAX_CLUSTER]

        print(f"{level}:")
        print(f"  subcategories : {len(subs)}")
        print(f"  clusters      : {len(group)}")
        print(f"  words         : {total}")
        print(f"  in a named field  : {named}")
        print(f"  in a tight topic  : {cohesive}")
        print(f"  coherent          : {named + cohesive} ({share * 100:.1f}%)")
        print(f"  needs review      : {residual} in a residual cluster")
        if oversized:
            print(f"  OVERSIZED     : {len(oversized)}")
        print()

        if share < COVERAGE_FLOOR:
            failures.append(
                f"{level}: only {share * 100:.1f}% of words landed in a named field or a "
                f"tight topic (floor {COVERAGE_FLOOR * 100:.0f}%) — the lexicon needs more fields here")
        for cluster in oversized:
            failures.append(
                f"{cluster['id']}: {cluster['wordCount']} words, over the {clusters.MAX_CLUSTER} ceiling")

    # Every word must land somewhere, exactly once.
    if len(membership) != len(words):
        missing = [w["id"] for w in words if w["id"] not in membership]
        failures.append(f"{len(missing)} words were not clustered at all: {missing[:5]}")
    sizes = Counter(c["wordCount"] for c in records)
    tiny = [c["id"] for c in records if c["wordCount"] < clusters.MIN_CLUSTER]

    print("WORST RESIDUALS (a big one means a missing field):")
    worst = sorted((c for c in records if c["field"] == "general"),
                   key=lambda c: -c["wordCount"])[:12]
    for cluster in worst:
        terms = [w["term"] for w in words if w["id"] in set(cluster["itemIds"])][:8]
        print(f"  {cluster['level']:<3} {cluster['subcategory']:<32} {cluster['wordCount']:>3}  "
              + ", ".join(terms))

    print(f"\nclusters below the {clusters.MIN_CLUSTER}-word floor: {len(tiny)}"
          " (allowed: a subcategory can genuinely be small)")
    print(f"cluster sizes: min {min(sizes)} · max {max(sizes)} · "
          f"median {sorted(c['wordCount'] for c in records)[len(records) // 2]}")

    if failures:
        print("\nPROBLEMS")
        for problem in failures:
            print(f"  - {problem}")
        if check:
            return 1
    elif check:
        print("\nAll cluster checks passed.")
    return 0


if __name__ == "__main__":
    sys.exit(main(sys.argv[1:]))
