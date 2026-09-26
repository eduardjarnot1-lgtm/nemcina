import { useCallback, useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { achievements, buildEvidence, earned, levelFor, totalXp, type Achievement } from '@nemcina/core';
import { useCourse } from '../course';
import { useProgress } from '../progress';
import { strings } from '../strings';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { Animated, duration, useCountUp, useEarned, usePulse } from '../motion';
import { haptic } from '../haptics';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

/**
 * Level, XP and achievements.
 *
 * All of it is recomputed from the attempt log rather than read from a stored
 * counter, so none of it can drift away from what the learner actually did —
 * and a badge nobody earned cannot appear, which is the only reason any of it
 * is worth showing.
 *
 * The motion here is the same discipline: it marks the moment something is
 * earned and is silent otherwise. Opening this screen does not replay past
 * achievements, and the numbers only count up when they have actually moved.
 */
export function LevelPanel() {
  const { repository } = useCourse();
  const { records, attempts } = useProgress();

  const level = useMemo(
    () => levelFor(totalXp(attempts, -new Date().getTimezoneOffset())),
    [attempts],
  );

  const badges = useMemo(() => achievements(
    buildEvidence({
      items: repository.vocabulary(),
      topics: repository.grammar(),
      progress: records,
      attempts,
      offsetMinutes: -new Date().getTimezoneOffset(),
    }),
    level,
  ), [repository, records, attempts, level]);

  const done = earned(badges);
  const into = useCountUp(level.into, { duration: duration.normal });

  return (
    <Card style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.title}>{strings.levelTitle} {level.level}</Text>
        {/* Only the earned half counts up. The span is the shape of the level,
            not something the learner just did, and animating it would make an
            unchanged number look like progress. */}
        <Text style={styles.meta}>{strings.levelProgress(into, level.span)}</Text>
      </View>
      <ProgressBar value={level.progress} />
      {/* Real arithmetic on real XP, shown only when it is nearly true. An
          encouragement that appears at the start of every level would be
          manufactured urgency rather than information. */}
      {level.span - level.into <= NEARLY && level.into < level.span ? (
        <Text style={styles.near}>{strings.levelAlmost(level.span - level.into)}</Text>
      ) : null}

      <View style={styles.header}>
        <Text style={styles.title}>{strings.achievementsTitle}</Text>
        <Text style={styles.meta}>{strings.achievementsEarned(done.length, badges.length)}</Text>
      </View>

      {badges.map((badge) => <Badge key={badge.id} badge={badge} />)}
    </Card>
  );
}

/** Close enough that finishing the level is a decision the learner can make now. */
const NEARLY = 30;

/**
 * One badge, which pulses on the single frame it is earned.
 *
 * The edge is what matters. A badge that celebrated on every render would fire
 * every time the profile is opened, and by the third time it would mean
 * nothing — so `useEarned` watches for false-to-true and ignores mounting.
 */
function Badge({ badge }: { badge: Achievement }) {
  const { pulse, style } = usePulse('strong');
  const celebrate = useCallback(() => {
    pulse();
    haptic('achievement');
  }, [pulse]);
  useEarned(badge.earned, celebrate);

  return (
    <Animated.View style={[styles.badge, badge.earned && styles.badgeEarnedRow, style]}>
      <Text style={[styles.badgeName, badge.earned && styles.badgeEarned]}>
        {strings.achievementNames[badge.id] ?? badge.id}
      </Text>
      {/* The number is shown whether or not it is finished: "38 of 50" is an
          invitation, where a locked icon is a shrug. */}
      <Text style={styles.meta}>{badge.progress} / {badge.target}</Text>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...typeScale.heading, color: palette.text },
  meta: { ...typeScale.caption, color: palette.textMuted },
  near: { ...typeScale.caption, color: palette.accent },
  badge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  badgeName: { ...typeScale.body, color: palette.textMuted },
  /**
   * Gold, because this one was earned. `goldInk` rather than `gold` — the
   * bright one is 2.07:1 on the background and cannot be read; this is the
   * same colour taken down until it can be.
   */
  badgeEarned: { color: palette.goldInk, fontWeight: '600' },
  badgeEarnedRow: { backgroundColor: palette.goldSoft, paddingHorizontal: spacing.sm },
});
