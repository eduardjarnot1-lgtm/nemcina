import { useMemo } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { isDue, lessonStatus, nextLesson, totals } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { strings } from '../../src/strings';
import { palette, spacing, type as typeScale } from '../../src/theme';

/**
 * The first screen.
 *
 * One decision: what should this person do right now. Reviews that are due come
 * first — letting them pile up is how a spaced-repetition app turns into a
 * backlog nobody opens — and otherwise it is the next unfinished lesson.
 */
export default function LearnScreen() {
  const router = useRouter();
  const { levelLessons } = useCourse();
  const { records, ready } = useProgress();

  const summary = useMemo(() => totals(records.values()), [records]);
  const next = useMemo(() => nextLesson(levelLessons, records), [levelLessons, records]);
  const nextStatus = useMemo(
    () => (next ? lessonStatus(next, records) : null),
    [next, records],
  );
  const dueCount = useMemo(
    () => [...records.values()].filter((record) => isDue(record)).length,
    [records],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.appName}>{strings.appName}</Text>

        <View style={styles.statRow}>
          <Stat label={strings.wordsLearned} value={summary.learned} />
          <Stat label={strings.wordsMastered} value={summary.mastered} />
          <Stat label={strings.dueToday} value={dueCount} />
        </View>

        {dueCount > 0 ? (
          <Card tone="accent" style={styles.block}>
            <Text style={styles.blockTitle}>{strings.dueToday}</Text>
            <Text style={styles.blockMeta}>{strings.itemsInLesson(dueCount)}</Text>
            <PrimaryButton
              label={strings.continueLesson}
              onPress={() => router.push('/session/review')}
            />
          </Card>
        ) : (
          <Card style={styles.block}>
            <Text style={styles.blockMeta}>{strings.dueNone}</Text>
          </Card>
        )}

        {next && nextStatus ? (
          <Card style={styles.block}>
            <Text style={styles.blockTitle}>{strings.lessonOf(next.index, next.total)}</Text>
            <Text style={styles.blockMeta}>
              {next.groupTitle} · {strings.itemsInLesson(nextStatus.total)}
            </Text>
            <ProgressBar value={nextStatus.completion} />
            <PrimaryButton
              label={nextStatus.started ? strings.continueLesson : strings.startLesson}
              onPress={() => router.push(`/session/${encodeURIComponent(next.id)}`)}
            />
          </Card>
        ) : ready ? (
          <Card style={styles.block}>
            <Text style={styles.blockMeta}>{strings.allLessonsDone}</Text>
          </Card>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

function Stat({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.stat}>
      <Text style={styles.statValue}>{value}</Text>
      <Text style={styles.statLabel}>{label}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  appName: { ...typeScale.display, color: palette.text },
  statRow: { flexDirection: 'row', gap: spacing.sm },
  stat: {
    flex: 1,
    backgroundColor: palette.surface,
    borderRadius: 12,
    paddingVertical: spacing.md,
    alignItems: 'center',
  },
  statValue: { ...typeScale.title, color: palette.text },
  statLabel: { ...typeScale.caption, color: palette.textMuted },
  block: { gap: spacing.sm },
  blockTitle: { ...typeScale.heading, color: palette.text },
  blockMeta: { ...typeScale.caption, color: palette.textMuted },
});
