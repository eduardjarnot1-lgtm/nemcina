import { useMemo, useState } from 'react';
import { FlatList, Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CEFR_LEVELS, topicProgress, type CefrLevel, type GrammarTopic } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { strings } from '../../src/strings';
import { palette, radius, spacing, type as typeScale } from '../../src/theme';

/**
 * The grammar index.
 *
 * Grouped by level rather than by the source document: a learner looking for
 * the dative does not care which coursebook it came from, and mixing three
 * publishers' section numbering into one list helps nobody.
 */
export default function GrammarScreen() {
  const router = useRouter();
  const { repository } = useCourse();
  const { records } = useProgress();
  const topics = repository.grammar();

  const levels = useMemo(
    () => CEFR_LEVELS.filter((level) => topics.some((topic) => topic.level === level)),
    [topics],
  );
  const b2 = useMemo(() => topics.filter((topic) => topic.level === 'B2'), [topics]);
  const b2Exercises = useMemo(
    () => b2.reduce((sum, topic) => sum + topic.exercises.length, 0),
    [b2],
  );

  const [level, setLevel] = useState<CefrLevel | null>(null);
  const active = level && levels.includes(level) ? level : levels[0] ?? null;
  const shown = useMemo(
    () => topics.filter((topic) => topic.level === active),
    [topics, active],
  );

  return (
    <Screen>
      <Text style={styles.title}>{strings.tabGrammar}</Text>
      <Text style={styles.count}>{strings.grammarTopics(topics.length)}</Text>

      <View style={styles.levelRow}>
        {levels.map((entry) => (
          <Pressable
            key={entry}
            accessibilityRole="button"
            accessibilityState={{ selected: entry === active }}
            onPress={() => setLevel(entry)}
            style={[styles.level, entry === active && styles.levelActive]}
          >
            <Text style={[styles.levelLabel, entry === active && styles.levelLabelActive]}>
              {entry}
            </Text>
          </Pressable>
        ))}
      </View>

      {b2.length > 0 ? (
        <Card style={styles.b2Banner} onPress={() => router.push('/grammar/b2')}>
          <View style={styles.b2Row}>
            <View style={styles.b2Mark}>
              <Text style={styles.b2MarkText}>B2</Text>
            </View>
            <View style={styles.b2Text}>
              <Text style={styles.b2Title}>{strings.b2GrammarBanner}</Text>
              <Text style={styles.b2Hint}>
                {strings.b2GrammarBannerHint(b2.length, b2Exercises)}
              </Text>
            </View>
          </View>
        </Card>
      ) : null}

      <FlatList
        data={shown}
        keyExtractor={(topic: GrammarTopic) => topic.id}
        contentContainerStyle={styles.list}
        showsVerticalScrollIndicator={false}
        renderItem={({ item }) => {
          const done = topicProgress(item, records);
          return (
            <Card
              style={styles.card}
              onPress={() => router.push(`/grammar/${encodeURIComponent(item.id)}`)}
            >
              <Text style={styles.topicTitle}>{item.title}</Text>
              {item.summary ? <Text style={styles.summary} numberOfLines={2}>{item.summary}</Text> : null}
              <Text style={styles.meta}>
                {strings.grammarExercises(done.total)}
                {done.learned > 0 ? ` · ${done.learned}/${done.total}` : ''}
              </Text>
              {done.learned > 0 ? (
                <ProgressBar
                  value={done.completion}
                  tone={done.completion === 1 ? palette.correct : palette.accent}
                />
              ) : null}
            </Card>
          );
        }}
      />
    </Screen>
  );
}

const styles = StyleSheet.create({
  title: { ...typeScale.display, color: palette.text, paddingTop: spacing.md },
  count: { ...typeScale.caption, color: palette.textMuted, paddingBottom: spacing.md },
  levelRow: { flexDirection: 'row', gap: spacing.sm, marginBottom: spacing.sm },
  level: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  levelActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  levelLabel: { ...typeScale.label, color: palette.textMuted },
  levelLabelActive: { color: '#ffffff' },
  b2Banner: { marginBottom: spacing.sm, borderColor: palette.accent },
  b2Row: { flexDirection: 'row', alignItems: 'center', gap: spacing.md },
  b2Mark: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.xs,
  },
  b2MarkText: { ...typeScale.label, color: '#ffffff' },
  b2Text: { flex: 1, gap: 2 },
  b2Title: { ...typeScale.heading, color: palette.text },
  b2Hint: { ...typeScale.caption, color: palette.textMuted },
  list: { paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  topicTitle: { ...typeScale.heading, color: palette.text },
  summary: { ...typeScale.caption, color: palette.textMuted },
  meta: { ...typeScale.caption, color: palette.textMuted },
});
