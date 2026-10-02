import { StyleSheet, Text, View } from 'react-native';
import type { ClusterStatus, VocabularyCluster } from '@nemcina/core';
import { palette, spacing, type as typeScale } from '../theme';
import { strings } from '../strings';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { Reveal } from './Reveal';

/**
 * One lesson in a topic (§10, §30).
 *
 * The row leads with what the lesson is *about* — "Airport & flying" — and
 * shows three of its actual words underneath. That preview is doing real work
 * on the lessons that carry a topic's own name rather than a field's: it is the
 * difference between "Household 2" meaning nothing and meaning light bulbs,
 * fuses and heating.
 *
 * Completion is content covered, not mastery, so a finished lesson with words
 * still owed says so rather than showing an unqualified tick (§32).
 */
export function ClusterRow({
  cluster, status, onPress, index = 0,
}: {
  cluster: VocabularyCluster;
  status: ClusterStatus;
  onPress: () => void;
  index?: number;
}) {
  const preview = cluster.preview.join(' · ');
  return (
    <Reveal index={index} once={`cluster-${cluster.id}`}>
      <Card onPress={onPress} style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{cluster.name}</Text>
          <Text style={styles.count}>
            {strings.itemsInLesson(status.total)} · {strings.lessonMinutes(status.total)}
          </Text>
        </View>
        {preview ? <Text style={styles.preview} numberOfLines={1}>{preview}</Text> : null}
        <ProgressBar
          value={status.completion}
          tone={status.complete ? palette.correct : palette.accent}
        />
        {status.due > 0 ? (
          <Text style={styles.due}>{status.due} due</Text>
        ) : null}
      </Card>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'baseline', gap: spacing.sm },
  title: { ...typeScale.heading, color: palette.text, flex: 1 },
  count: { ...typeScale.caption, color: palette.textMuted },
  preview: { ...typeScale.caption, color: palette.textSecond, marginBottom: spacing.xs },
  due: { ...typeScale.caption, color: palette.accent },
});
