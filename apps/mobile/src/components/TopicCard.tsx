import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typeScale } from '../theme';
import { strings } from '../strings';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';
import { Reveal } from './Reveal';

/**
 * One topic in the browse list (§31).
 *
 * Shows mastery rather than "words seen". A learner who has been shown every
 * word in Travel once has not mastered Travel, and a card that said 80/80 would
 * be the kind of flattery that stops meaning anything by the second topic.
 */
export function TopicCard({
  title, level, mastered, total, lessons, completion, onPress, index = 0, once,
}: {
  title: string;
  level: string;
  mastered: number;
  total: number;
  lessons: number;
  completion: number;
  onPress: () => void;
  index?: number;
  once?: string;
}) {
  return (
    <Reveal index={index} once={once}>
      <Card onPress={onPress} style={styles.card}>
        <View style={styles.header}>
          <Text style={styles.title}>{title}</Text>
          <Text style={styles.level}>{level}</Text>
        </View>
        <Text style={styles.meta}>
          {strings.topicWords(mastered, total)} · {strings.topicLessons(lessons)}
        </Text>
        <ProgressBar
          value={completion}
          tone={completion >= 1 ? palette.correct : palette.accent}
        />
      </Card>
    </Reveal>
  );
}

const styles = StyleSheet.create({
  card: { marginBottom: spacing.sm, gap: spacing.sm },
  header: { flexDirection: 'row', justifyContent: 'space-between', alignItems: 'center', gap: spacing.sm },
  title: { ...typeScale.heading, color: palette.text, flex: 1 },
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
