import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { grammarFamily, isExceptionHeading, ruleShape } from '../src/grammarShape.ts';

const corpus = JSON.parse(
  readFileSync(new URL('../../../app/data/grammar.json', import.meta.url), 'utf8'),
) as { topics: { category: string; rules: string[]; explanation: { heading: string }[] }[] };

test('grammar shapes', async (t) => {
  await t.test('the corpus\'s own "Achtung:" becomes a warning, and loses the label', () => {
    const shape = ruleShape('Achtung: würde haben sounds wrong; use hätte.');
    assert.equal(shape.kind, 'warning');
    // The label is the marker, not the sentence — repeating it inside a box
    // that already reads as a warning says it twice.
    assert.equal(shape.text, 'würde haben sounds wrong; use hätte.');
  });

  await t.test('a bare marker is not a warning', () => {
    assert.equal(ruleShape('Achtung:').kind, 'plain');
  });

  await t.test('a sentence with no marker stays plain, unchanged', () => {
    const rule = 'The present tense endings are -e, -st, -t.';
    assert.deepEqual(ruleShape(rule), { kind: 'plain', text: rule });
  });

  await t.test('an arrow rule is deliberately left as prose', () => {
    // The arrow is not reliable notation in this corpus: here it sits inside a
    // sentence, so splitting on it would print "So the only difference is
    // masculine der" as a form. See the module docstring.
    assert.equal(ruleShape('So the only difference is masculine der → den.').kind, 'plain');
  });

  await t.test('every rule in the real corpus classifies, and none renders empty', () => {
    let warnings = 0;
    for (const topic of corpus.topics) {
      for (const rule of topic.rules) {
        const shape = ruleShape(rule);
        if (shape.kind === 'warning') warnings += 1;
        assert.ok(shape.text.trim().length > 0, `${rule} rendered empty`);
      }
    }
    // Pinned, so that a corpus edit removing the authors' emphasis — or a
    // parser change that stops seeing it — is noticed rather than silent.
    assert.equal(warnings, 14, 'expected the 14 Achtung rules the corpus carries');
  });

  await t.test('a heading that calls itself an exception is one', () => {
    assert.equal(isExceptionHeading('The one exception'), true);
    assert.equal(isExceptionHeading('The commonest mistake'), true);
    // Prose is not scanned: "not" and "never" appear in 54 topics and are
    // almost always an ordinary rule stated negatively.
    assert.equal(isExceptionHeading('What it is for'), false);
    assert.equal(isExceptionHeading('The verb does not move'), false);
  });

  await t.test('the corpus carries exactly the five exception headings', () => {
    const found = corpus.topics.flatMap((topic) =>
      topic.explanation.filter((section) => isExceptionHeading(section.heading)));
    // Pinned: if the corpus gains or loses one, the count says so rather than
    // the box quietly appearing on a different number of pages.
    assert.equal(found.length, 5);
  });

  await t.test('every category in the real corpus has a family', () => {
    const unknown = new Set<string>();
    for (const topic of corpus.topics) {
      if (grammarFamily(topic.category) === 'other') unknown.add(topic.category);
    }
    // 'other' is a real family, but a category landing there should be a
    // decision rather than an oversight, so the ones that do are named here.
    assert.deepEqual([...unknown].sort(), ['Stil', 'Wortbildung', 'Wortschatzstrukturen']);
  });
});
