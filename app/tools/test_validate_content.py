"""The validator's own rules, on fixtures.

`validate_content.py` is the licensing gate and the content gate: it is the
last thing between a bad card and the published app, and until now nothing
checked the gate itself. A rule quietly weakened by a refactor would have
looked exactly like a rule that had nothing to complain about.

These are not a survey of everything it checks — 180 000 assertions run against
the real corpus every build and that is where coverage comes from. They are the
rules that were written *because* something got through: each one below names
the failure it exists to stop.

The module reads its data from two module-level paths, so a test points those
at a fixture file and calls the one function it wants. No production code moved
to make that possible.
"""

import contextlib
import io
import json
import tempfile
import unittest
from pathlib import Path

import validate_content as vc


def grammar_db(topics: list[dict]) -> dict:
    return {
        "meta": {"sources": [{"key": "k", "title": "A source", "credit": "Someone"}]},
        "topics": topics,
    }


def topic(**overrides) -> dict:
    """A topic that passes every check, so a test can break exactly one thing."""
    base = {
        "id": "g-1", "language": "de", "level": "A1", "title": "Present tense",
        "titleEn": "Present tense", "summary": "A summary.",
        "group": "Verbs", "groupOrder": 1, "order": 1, "difficulty": 3,
        "category": "Verben", "tags": [], "subtopics": [],
        "kursbuch": "", "subsection": "",
        "source": "A source", "sourceKey": "k", "sourcePage": 1, "sourcePages": [1],
        "explanation": [{"heading": "How", "text": "Like this."}],
        "rules": ["A rule."],
        "examples": [{"de": "ich komme", "en": "I come", "note": "", "marks": []}],
        "exercises": [{
            "id": "g-1-e1", "topicId": "g-1", "type": "fill",
            "prompt": "Complete the du-form.", "text": "Woher ___ du?",
            "from": "", "options": [], "answers": ["kommst"], "tokens": [],
            "hint": "", "explain": "Regular du-ending is -st.", "fromSource": False,
        }],
        "prerequisites": [], "tables": [],
        "comparison": None, "formulas": [],
    }
    base.update(overrides)
    return base


class GrammarRules(unittest.TestCase):
    def check(self, topics: list[dict]) -> vc.Report:
        report = vc.Report()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "grammar.json"
            path.write_text(json.dumps(grammar_db(topics)), encoding="utf-8")
            original, vc.GRAMMAR = vc.GRAMMAR, path
            try:
                # The validator prints its tallies; a fixture's tallies are
                # noise between one test's name and the next.
                with contextlib.redirect_stdout(io.StringIO()):
                    vc.validate_grammar(report)
            finally:
                vc.GRAMMAR = original
        return report

    def assertFails(self, topics: list[dict], fragment: str) -> None:
        errors = self.check(topics).errors
        self.assertTrue(
            any(fragment in e for e in errors),
            f"expected an error mentioning {fragment!r}, got {errors}")

    def assertPasses(self, topics: list[dict]) -> None:
        self.assertEqual(self.check(topics).errors, [])

    def test_a_well_formed_topic_passes(self):
        # Without this the rest could all be passing for the wrong reason.
        self.assertPasses([topic()])

    def test_half_classed_topic_fails(self):
        # The failure this whole line of work exists because of: "Wenn"
        # highlighted as a connector and "Als" three lines below left neutral
        # reads as a distinction, and there is none — the second one had
        # simply not been written yet.
        self.assertFails([topic(examples=[
            {"de": "Wenn es regnet", "en": "When it rains", "note": "",
             "marks": [{"start": 0, "end": 4, "role": "conj"}]},
            {"de": "Als es regnete", "en": "When it rained", "note": "",
             "marks": [{"start": 0, "end": 3, "role": ""}]},
        ])], "reads as a distinction that is not there")

    def test_all_neutral_topic_passes(self):
        # Most topics are this: marks from the build's automatic pass, which
        # says which form is taught and nothing about its word class. The rule
        # above must not turn that normal state into an error.
        self.assertPasses([topic(examples=[
            {"de": "ich komme", "en": "I come", "note": "",
             "marks": [{"start": 4, "end": 9, "role": ""}]},
            {"de": "du kommst", "en": "you come", "note": "",
             "marks": [{"start": 3, "end": 9, "role": ""}]},
        ])])

    def test_one_word_marked_two_ways_in_one_topic_fails(self):
        self.assertFails([topic(examples=[
            {"de": "weil es regnet", "en": "because it rains", "note": "",
             "marks": [{"start": 0, "end": 4, "role": "conj"}]},
            {"de": "Weil es schneit", "en": "because it snows", "note": "",
             "marks": [{"start": 0, "end": 4, "role": "verb"}]},
        ])], "one word, one treatment")

    def test_unknown_word_class_fails(self):
        # An unknown class renders as neutral, which looks like a mark that was
        # never meant to carry one.
        self.assertFails([topic(examples=[
            {"de": "ich komme", "en": "I come", "note": "",
             "marks": [{"start": 0, "end": 3, "role": "gerund"}]},
        ])], "unknown role")

    def test_a_highlight_past_the_end_of_its_sentence_fails(self):
        self.assertFails([topic(examples=[
            {"de": "ich komme", "en": "I come", "note": "",
             "marks": [{"start": 0, "end": 99, "role": ""}]},
        ])], "does not fit")

    def test_overlapping_highlights_fail(self):
        self.assertFails([topic(examples=[
            {"de": "ich komme", "en": "I come", "note": "",
             "marks": [{"start": 0, "end": 5, "role": ""},
                       {"start": 3, "end": 9, "role": ""}]},
        ])], "overlap")

    def test_english_that_is_the_german_again_fails(self):
        # Caught a real one on its first run: a list of contractions where the
        # German had been stored as its own translation.
        self.assertFails([topic(examples=[
            {"de": "zu dem = zum", "en": "zu dem = zum", "note": "", "marks": []},
        ])], "is the German again")

    def test_a_one_slot_formula_fails(self):
        # One slot is not a shape; it would read as a truncated pattern.
        self.assertFails([topic(formulas=[
            {"caption": "", "slots": [{"text": "weil", "role": "conj"}]},
        ])], "is not a shape")

    def test_a_formula_slot_with_an_unknown_class_fails(self):
        self.assertFails([topic(formulas=[
            {"caption": "", "slots": [{"text": "weil", "role": "gerund"},
                                      {"text": "Verb", "role": "verb"}]},
        ])], "unknown role")

    def test_a_prerequisite_that_does_not_exist_fails(self):
        self.assertFails([topic(prerequisites=["g-nope"])], "unknown prerequisite")

    def test_a_prerequisite_cycle_fails(self):
        self.assertFails(
            [topic(id="g-1", prerequisites=["g-2"]),
             topic(id="g-2", title="Other", prerequisites=["g-1"])],
            "cycle")

    def test_a_topic_with_no_source_credit_fails(self):
        # The licensing gate: these explanations are somebody's work.
        report = vc.Report()
        with tempfile.TemporaryDirectory() as tmp:
            path = Path(tmp) / "grammar.json"
            db = grammar_db([topic()])
            db["meta"]["sources"][0]["credit"] = ""
            path.write_text(json.dumps(db), encoding="utf-8")
            original, vc.GRAMMAR = vc.GRAMMAR, path
            try:
                with contextlib.redirect_stdout(io.StringIO()):
                    vc.validate_grammar(report)
            finally:
                vc.GRAMMAR = original
        self.assertTrue(any("credit" in e for e in report.errors), report.errors)


if __name__ == "__main__":
    unittest.main()
