import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { grammarFamily, topicProgress } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ProgressBar } from '../../src/components/ProgressBar';
import { Reveal } from '../../src/components/Reveal';
import { Chip } from '../../src/components/grammar/Chip';
import { RuleList } from '../../src/components/grammar/RuleList';
import { ExampleList } from '../../src/components/grammar/ExampleList';
import { Section } from '../../src/components/grammar/Section';
import { Collapsible } from '../../src/components/grammar/Collapsible';
import { GrammarTable } from '../../src/components/grammar/GrammarTable';
import { CommonMistake } from '../../src/components/grammar/CommonMistake';
import { familyTone } from '../../src/grammarTheme';
import { useCourse } from '../../src/course';
import { useProgress } from '../../src/progress';
import { strings } from '../../src/strings';
import { palette, spacing, type as typeScale } from '../../src/theme';

/** Explanation sections shown before the rest is folded away. */
const OPEN_SECTIONS = 2;

/**
 * One grammar topic.
 *
 * The page answers three questions in the order someone actually asks them:
 * what is this (the summary), what must I remember (the rules), what does it
 * look like (the examples) — and only then the longer explanation, because
 * that is the part you read when the first three were not enough.
 *
 * It used to be five identical cards in source order, which meant a rule, a
 * paragraph and a sentence of German all carried the same weight and the page
 * had to be read from the top to find anything. Nothing about the content has
 * changed; the order and the weight have.
 *
 * Practice sits at the bottom and at full width: it is the thing to do after
 * reading, and it should be reachable without hunting.
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
  const tone = familyTone[grammarFamily(topic.category)];
  const first = topic.explanation.slice(0, OPEN_SECTIONS);
  const rest = topic.explanation.slice(OPEN_SECTIONS);
  // The topic's own error-correction exercise, shown worked. 89 of 136 topics
  // have one; the rest simply do not get this card.
  const mistake = topic.exercises.find((exercise) => exercise.kind === 'error-correction');

  return (
    <Screen>
      <Stack.Screen options={{ title: topic.level }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Reveal index={0}>
          <View style={styles.header}>
            <View style={styles.chips}>
              <Chip label={topic.level} ink={palette.accent} wash={palette.accentSoft} />
              {/* The family is named as well as coloured. */}
              <Chip label={tone.label} ink={tone.ink} wash={tone.wash} />
            </View>
            <Text style={styles.title}>{topic.title}</Text>
            {topic.summary ? <Text style={styles.summary}>{topic.summary}</Text> : null}
          </View>
        </Reveal>

        {topic.rules.length > 0 ? (
          <Reveal index={1}>
            <Card style={styles.block}>
              <Text style={styles.sectionLabel}>{strings.grammarInShort}</Text>
              <RuleList rules={topic.rules} />
            </Card>
          </Reveal>
        ) : null}

        {topic.tables.length > 0 ? (
          <Reveal index={2}>
            <Card style={styles.block}>
              <Text style={styles.sectionLabel}>{strings.grammarForms}</Text>
              {topic.tables.map((table, index) => (
                <GrammarTable key={index} table={table} />
              ))}
            </Card>
          </Reveal>
        ) : null}

        {topic.examples.length > 0 ? (
          <Reveal index={3}>
            <Card style={styles.block}>
              <Text style={styles.sectionLabel}>{strings.grammarExamples}</Text>
              <ExampleList examples={topic.examples} />
            </Card>
          </Reveal>
        ) : null}

        {mistake ? (
          <Reveal index={4}>
            <Card style={styles.block}>
              <Text style={styles.sectionLabel}>{strings.grammarCommonMistake}</Text>
              {/* Closed by default: this is one of the topic's own exercises,
                  and opening it spends that answer. The learner decides. */}
              <Collapsible
                label={strings.grammarShowLess}
                collapsedLabel={strings.grammarShowMistake}
              >
                <CommonMistake exercise={mistake} />
              </Collapsible>
            </Card>
          </Reveal>
        ) : null}

        {topic.explanation.length > 0 ? (
          <Reveal index={4}>
            <Card style={styles.block}>
              <Text style={styles.sectionLabel}>{strings.grammarHowItWorks}</Text>
              {first.map((section, index) => (
                <Section
                  key={`${section.heading}-${index}`}
                  heading={section.heading}
                  text={section.text}
                  ink={tone.ink}
                />
              ))}
              {rest.length > 0 ? (
                <Collapsible
                  label={strings.grammarShowLess}
                  collapsedLabel={strings.grammarShowMore(rest.length)}
                >
                  {rest.map((section, index) => (
                    <Section
                      key={`${section.heading}-${index}`}
                      heading={section.heading}
                      text={section.text}
                      ink={tone.ink}
                    />
                  ))}
                </Collapsible>
              ) : null}
            </Card>
          </Reveal>
        ) : null}

        <Reveal index={4}>
          {topic.exercises.length > 0 ? (
            <Card style={styles.block}>
              <Text style={styles.sectionLabel}>{strings.grammarExercises(done.total)}</Text>
              {done.learned > 0 ? <ProgressBar value={done.completion} /> : null}
              <PrimaryButton
                label={strings.grammarPractise}
                onPress={() => router.push(`/grammar/practice/${encodeURIComponent(topic.id)}`)}
              />
            </Card>
          ) : (
            <Text style={styles.source}>{strings.grammarNoExercises}</Text>
          )}
        </Reveal>

        {/* The source is credited on the page rather than buried in a licence
            file: these explanations are somebody's work, and the app says whose. */}
        {topic.source.title ? (
          <Text style={styles.source}>
            {strings.grammarSource} {topic.source.title}
            {topic.source.page > 0 ? `, p. ${topic.source.page}` : ''}
          </Text>
        ) : null}
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  missing: { ...typeScale.body, color: palette.textMuted, padding: spacing.md },
  header: { gap: spacing.sm },
  chips: { flexDirection: 'row', gap: spacing.xs, flexWrap: 'wrap' },
  title: { ...typeScale.title, color: palette.text },
  summary: { ...typeScale.body, color: palette.text, lineHeight: 24 },
  block: { gap: spacing.md },
  sectionLabel: { ...typeScale.label, color: palette.textMuted, letterSpacing: 0.6 },
  source: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
});
