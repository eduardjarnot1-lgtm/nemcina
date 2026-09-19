import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { topicProgress } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { strings } from '../../src/strings';
import { palette, spacing, type as typeScale } from '../../src/theme';

/**
 * One grammar topic.
 *
 * Explanation first, practice after. The source is credited on the page rather
 * than buried in a licence file: these explanations are somebody's work, and the
 * app says whose.
 */
export default function GrammarTopicScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { repository } = useCourse();
  const { records } = useProgress();

  const topic = repository.topic(decodeURIComponent(String(topicId ?? '')));
  if (!topic) {
    return (
      <Screen>
        <Text style={styles.missing}>{strings.searchNoResults}</Text>
      </Screen>
    );
  }

  const done = topicProgress(topic, records);

  return (
    <Screen>
      <Stack.Screen options={{ title: topic.level }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{topic.title}</Text>
        {topic.summary ? <Text style={styles.summary}>{topic.summary}</Text> : null}

        {topic.explanation.map((section, index) => (
          <Card key={`${section.heading}-${index}`} style={styles.block}>
            {section.heading ? <Text style={styles.heading}>{section.heading}</Text> : null}
            <Text style={styles.body}>{section.text}</Text>
          </Card>
        ))}

        {topic.rules.length > 0 ? (
          <Card style={styles.block}>
            <Text style={styles.heading}>{strings.grammarRules}</Text>
            {topic.rules.map((rule, index) => (
              <Text key={index} style={styles.rule}>{rule}</Text>
            ))}
          </Card>
        ) : null}

        {topic.examples.length > 0 ? (
          <Card style={styles.block}>
            <Text style={styles.heading}>{strings.grammarExamples}</Text>
            {topic.examples.map((example, index) => (
              <View key={index} style={styles.example}>
                <Text style={styles.exampleText}>{example.text}</Text>
                {example.note ? <Text style={styles.exampleNote}>{example.note}</Text> : null}
              </View>
            ))}
          </Card>
        ) : null}

        {topic.source.title ? (
          <Text style={styles.source}>
            {strings.grammarSource} {topic.source.title}
            {topic.source.page > 0 ? `, p. ${topic.source.page}` : ''}
          </Text>
        ) : null}

        {topic.exercises.length > 0 ? (
          <Card style={styles.block}>
            <Text style={styles.heading}>{strings.grammarExercises(done.total)}</Text>
            {done.learned > 0 ? <ProgressBar value={done.completion} /> : null}
            <PrimaryButton
              label={strings.grammarPractise}
              onPress={() => router.push(`/grammar/practice/${encodeURIComponent(topic.id)}`)}
            />
          </Card>
        ) : (
          <Text style={styles.source}>{strings.grammarNoExercises}</Text>
        )}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  missing: { ...typeScale.body, color: palette.textMuted, padding: spacing.md },
  title: { ...typeScale.title, color: palette.text },
  summary: { ...typeScale.body, color: palette.textMuted },
  block: { gap: spacing.sm },
  heading: { ...typeScale.heading, color: palette.text },
  body: { ...typeScale.body, color: palette.text, lineHeight: 23 },
  rule: { ...typeScale.body, color: palette.text, lineHeight: 23 },
  example: { gap: 2 },
  exampleText: { ...typeScale.body, color: palette.text },
  exampleNote: { ...typeScale.caption, color: palette.textMuted },
  source: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
});
