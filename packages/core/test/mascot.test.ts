import { describe, test } from 'node:test';
import assert from 'node:assert/strict';
import {
  isComeback, isRunMilestone, isStreakMilestone, mascotLine, RUN_MILESTONES,
  sessionMoment, STREAK_MILESTONES, type MascotMoment,
} from '../src/mascot.ts';

const ALL: readonly MascotMoment[] = [
  'welcome', 'comeback', 'sessionDone', 'sessionStrong', 'sessionPerfect',
  'streakMilestone', 'achievement', 'encouragement', 'thinking',
];

describe('what Master Fuka says', () => {
  test('every moment has more than one line', () => {
    // One line per moment is a character who says the same eight words for a
    // year, which is the thing the variation exists to prevent.
    for (const moment of ALL) {
      const seen = new Set<string>();
      for (let i = 0; i < 40; i += 1) seen.add(mascotLine(moment).text);
      assert.ok(seen.size > 1, `${moment} only ever says ${[...seen][0]}`);
    }
  });

  test('he does not repeat the line he just used', () => {
    const seen = new Map<MascotMoment, string>();
    let previous = '';
    for (let i = 0; i < 50; i += 1) {
      const line = mascotLine('sessionDone', { seen });
      assert.notEqual(line.text, previous, 'said the same thing twice in a row');
      previous = line.text;
    }
  });

  test('every line is short enough to read at a glance', () => {
    // The brief's ceiling is twelve words. A guide who gives speeches is one
    // people tap past, and then he might as well not be there.
    for (const moment of ALL) {
      for (let i = 0; i < 40; i += 1) {
        const { text } = mascotLine(moment);
        assert.ok(text.split(/\s+/).length <= 12, `too long for ${moment}: ${text}`);
      }
    }
  });

  test('he never shouts and never blames', () => {
    // The two failure modes that would make him unbearable: a slot machine on
    // a good day, a scold on a bad one. Cheap to check, and the check is the
    // only thing standing between the rule and a future edit that forgets it.
    // Narrowed deliberately. An earlier version banned the word "missed"
    // outright and rejected "the ones you missed will come round sooner",
    // which is a fact about the schedule and one of the more useful things he
    // says. What is banned is the *construction* — a second person plus a
    // failure — not a word that also appears in neutral sentences.
    const forbidden = new RegExp([
      '!!', 'AMAZING',
      String.raw`\byou (failed|didn't|should have|never)\b`,
      String.raw`\blost your\b`,
      String.raw`\bmissed (a day|days|your)\b`,
      String.raw`\bstreak is (gone|over|broken|lost)\b`,
    ].join('|'), 'i');
    for (const moment of ALL) {
      for (let i = 0; i < 40; i += 1) {
        const { text } = mascotLine(moment);
        assert.doesNotMatch(text, forbidden, `${moment} said: ${text}`);
      }
    }
  });

  test('the ordinary ending never praises, because it fires at any accuracy', () => {
    // This moment is reached after a round the learner got thirteen per cent
    // of, as readily as after a good one. "Steady work" at thirteen per cent
    // is hollow, and hollow is how a guide stops being believed. What is left
    // is what happens next, which is true at either end of the range.
    const praise = /\bgood\b|\bwell done\b|\bnice\b|\bgreat\b|\bsteady\b|\bstrong\b|\bexcellent\b/i;
    for (let i = 0; i < 60; i += 1) {
      assert.doesNotMatch(mascotLine('sessionDone').text, praise);
    }
  });

  test('the comeback lines never mention the gap', () => {
    // The one moment where the wrong sentence does real damage: they already
    // know how long it has been, and they came back anyway.
    const guilt = /streak|again after|been a while|where have you|long time/i;
    for (let i = 0; i < 60; i += 1) {
      assert.doesNotMatch(mascotLine('comeback').text, guilt);
    }
  });

  test('a caller can make the choice deterministic', () => {
    const first = mascotLine('welcome', { pick: () => 0 });
    assert.deepEqual(mascotLine('welcome', { pick: () => 0 }), first);
  });

  test('an out-of-range pick is clamped rather than crashing', () => {
    assert.ok(mascotLine('welcome', { pick: () => 99 }).text);
    assert.ok(mascotLine('welcome', { pick: () => -5 }).text);
  });
});

describe('when he reacts at all', () => {
  test('the fists come out only for a perfect round', () => {
    assert.equal(mascotLine('sessionPerfect').pose, 'celebrate');
    assert.equal(mascotLine('sessionDone').pose, 'pleased');
    assert.equal(mascotLine('sessionStrong').pose, 'pleased');
  });

  test('two for two is not a perfect lesson', () => {
    // Short rounds are easy to make flawless, and a celebration that cheap
    // stops meaning anything by the third one.
    assert.equal(
      sessionMoment({ itemsStudied: 2, incorrect: 0, accuracy: 1 }), 'sessionDone');
    assert.equal(
      sessionMoment({ itemsStudied: 8, incorrect: 0, accuracy: 1 }), 'sessionPerfect');
  });

  test('a strong round is not a perfect one', () => {
    assert.equal(
      sessionMoment({ itemsStudied: 10, incorrect: 1, accuracy: 0.9 }), 'sessionStrong');
    assert.equal(
      sessionMoment({ itemsStudied: 10, incorrect: 4, accuracy: 0.6 }), 'sessionDone');
  });

  test('streak milestones thin out rather than repeating', () => {
    // Every day would be noise by the second week; the gaps are what make the
    // hundredth day mean more than the ninety-ninth.
    assert.ok(isStreakMilestone(7));
    assert.ok(!isStreakMilestone(8));
    const gaps = STREAK_MILESTONES.slice(1)
      .map((day, i) => day - (STREAK_MILESTONES[i] as number));
    assert.deepEqual(gaps, [...gaps].sort((a, b) => a - b), 'gaps must never narrow');
  });

  test('he does not comment on a run of three', () => {
    // Three happens in most sessions. Reacting to it would put him on screen
    // several times a lesson, which is the fastest way to turn a companion
    // into an interruption.
    assert.equal(isRunMilestone(3), false);
    assert.equal(isRunMilestone(5), true);
    assert.equal(isRunMilestone(6), false);
    const gaps = RUN_MILESTONES.slice(1).map((n, i) => n - (RUN_MILESTONES[i] as number));
    assert.deepEqual(gaps, [...gaps].sort((a, b) => a - b), 'gaps must never narrow');
  });

  test('one missed day is not a comeback', () => {
    const day = 86_400_000;
    const now = 1_700_000_000_000;
    assert.equal(isComeback(now - day, now), false, 'a single evening off');
    assert.equal(isComeback(now - 3 * day, now), true);
    assert.equal(isComeback(null, now), false, 'a fresh install has nobody to welcome back');
  });
});
