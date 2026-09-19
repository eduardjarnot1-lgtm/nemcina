import { StyleSheet, Text, View } from 'react-native';
import type { Lesson, LessonStatus } from '@nemcina/core';
import { palette, spacing, type as typeScale } from '../theme';
import { strings } from '../strings';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

/**
 * One lesson in a list.
 *
 * Shows how far through it the learner is rather than a tick or nothing: a bar
 * at 60 % is an invitation to finish, where "incomplete" is just a reproach.
 */
export function LessonRow({
  lesson, status, onPress,
}: {
  lesson: Lesson;
  status: LessonStatus;
  onPress: () => void;
}) {
  return (
    <Card onPress={onPress} style={styles.card}>
      <View style={styles.header}>
        <Text style={styles.title}>{strings.lessonOf(lesson.index, lesson.total)}</Text>
        {lesson.level ? <Text style={styles.level}>{lesson.level}</Text> : null}
      </View>
      <Text style={styles.meta}>
        {strings.itemsInLesson(status.total)}
        {status.learned > 0 ? ` · ${status.learned}/${status.total}` : ''}
      </Text>
      <ProgressBar
        value={status.completion}
        tone={status.complete ? palette.correct : palette.accent}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center' },
  title: { ...typeScale.heading, color: palette.text },
  level: {
    ...typeScale.label,
    color: palette.accent,
    backgroundColor: palette.accentSoft,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: 999,
    overflow: 'hidden',
  },
  meta: { ...typeScale.caption, color: palette.textMuted },
});
