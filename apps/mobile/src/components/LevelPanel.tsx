import { useMemo } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { achievements, buildEvidence, earned, levelFor, totalXp } from '@nemcina/core';
import { useCourse } from '../course';
import { useProgress } from '../progress';
import { strings } from '../strings';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

/**
 * Level, XP and achievements.
 *
 * All of it is recomputed from the attempt log rather than read from a stored
 * counter, so none of it can drift away from what the learner actually did —
 * and a badge nobody earned cannot appear, which is the only reason any of it
 * is worth showing.
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

  return (
    <Card style={styles.block}>
      <View style={styles.header}>
        <Text style={styles.title}>{strings.levelTitle} {level.level}</Text>
        <Text style={styles.meta}>{strings.levelProgress(level.into, level.span)}</Text>
      </View>
      <ProgressBar value={level.progress} />

      <View style={styles.header}>
        <Text style={styles.title}>{strings.achievementsTitle}</Text>
        <Text style={styles.meta}>{strings.achievementsEarned(done.length, badges.length)}</Text>
      </View>

      {badges.map((badge) => (
        <View key={badge.id} style={styles.badge}>
          <Text style={[styles.badgeName, badge.earned && styles.badgeEarned]}>
            {strings.achievementNames[badge.id] ?? badge.id}
          </Text>
          {/* The number is shown whether or not it is finished: "38 of 50" is an
              invitation, where a locked icon is a shrug. */}
          <Text style={styles.meta}>{badge.progress} / {badge.target}</Text>
        </View>
      ))}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline' },
  title: { ...typeScale.heading, color: palette.text },
  meta: { ...typeScale.caption, color: palette.textMuted },
  badge: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
    borderRadius: radius.sm,
  },
  badgeName: { ...typeScale.body, color: palette.textMuted },
  badgeEarned: { color: palette.correct, fontWeight: '600' },
});
