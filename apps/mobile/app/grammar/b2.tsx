import { useMemo } from 'react';
import { FlatList, StyleSheet, Text, View } from 'react-native';
import { useRouter, Stack } from 'expo-router';
import { topicProgress, type GrammarTopic } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { strings } from '../../src/strings';
import { palette, radius, spacing, type as typeScale } from '../../src/theme';

/**
 * The B2 grammar section.
 *
 * B2 held no grammar at all until this set was written for the app, so it gets a
 * screen of its own rather than being one chip among five on the grammar tab: it
 * is the level the vocabulary already reaches, and the only grammar here that
 * was composed for this project instead of extracted from a published course.
 *
 * Topics are grouped by the document they came from, with that document's credit
 * shown, so a second B2 source would appear beside this one rather than silently
 * mixing into it.
 *
 * This route is a static segment and therefore wins over `[topicId]`, which is
 * safe because every real topic id begins with `g-`.
 */
export default function B2GrammarScreen() {
  const router = useRouter();
  const { repository } = useCourse();
  const { records } = useProgress();

  const topics = useMemo(() => repository.grammar({ levels: ['B2'] }), [repository]);

  const totals = useMemo(() => {
    const done = topics.map((topic) => topicProgress(topic, records));
    return {
      exercises: done.reduce((sum, entry) => sum + entry.total, 0),
      learned: done.reduce((sum, entry) => sum + entry.learned, 0),
      started: done.filter((entry) => entry.learned > 0).length,
    };
  }, [topics, records]);

  const sources = useMemo(
    () => [...new Set(topics.map((topic) => topic.source.title))].filter(Boolean),
    [topics],
  );

  if (topics.length === 0) {
    return (
      <Screen>
        <Stack.Screen options={{ title: 'B2' }} />
        <Text style={styles.missing}>{strings.b2GrammarEmpty}</Text>
      </Screen>
    );
  }

  return (
    <Screen>
      <Stack.Screen options={{ title: 'B2' }} />
      <Text style={styles.title}>{strings.b2GrammarTitle}</Text>
      <Text style={styles.count}>
        {strings.grammarTopics(topics.length)} · {strings.grammarExercises(totals.exercises)}
        {totals.started > 0 ? ` · ${totals.started} started` : ''}
      </Text>

      {totals.learned > 0 ? (
        <ProgressBar
          value={totals.exercises === 0 ? 0 : totals.learned / totals.exercises}
          tone={palette.accent}
        />
      ) : null}

      <View style={styles.intro}>
        <Text style={styles.introText}>{strings.b2GrammarIntro}</Text>
        {sources.map((source) => (
          <Text key={source} style={styles.source}>
            {source}
          </Text>
        ))}
      </View>

      <FlatList
        data={topics}
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
              {item.titleInSourceLanguage && item.titleInSourceLanguage !== item.title ? (
                <Text style={styles.topicEn}>{item.titleInSourceLanguage}</Text>
              ) : null}
              {item.summary ? (
                <Text style={styles.summary} numberOfLines={2}>
                  {item.summary}
                </Text>
              ) : null}
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
  count: { ...typeScale.caption, color: palette.textMuted, paddingBottom: spacing.sm },
  intro: {
    backgroundColor: palette.surface,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
    marginVertical: spacing.sm,
    gap: spacing.xs,
  },
  introText: { ...typeScale.caption, color: palette.text },
  source: { ...typeScale.caption, color: palette.textMuted },
  list: { paddingBottom: spacing.xl },
  card: { marginBottom: spacing.sm, gap: spacing.xs },
  topicTitle: { ...typeScale.heading, color: palette.text },
  topicEn: { ...typeScale.caption, color: palette.textMuted },
  summary: { ...typeScale.caption, color: palette.textMuted },
  meta: { ...typeScale.caption, color: palette.textMuted },
  missing: { ...typeScale.body, color: palette.textMuted, paddingTop: spacing.lg },
});
