import { useCallback, useEffect, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { GrammarPractice, type ExerciseKind, type GrammarOutcome } from '@nemcina/core';
import { Screen } from '../../../src/components/Screen';
import { Card } from '../../../src/components/Card';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { useCourse } from '../../../src/course';
import { LOCAL_USER, useProgress } from '../../../src/progress';
import { strings } from '../../../src/strings';
import { palette, radius, spacing, type as typeScale } from '../../../src/theme';

const PROMPTS: Partial<Record<ExerciseKind, string>> = {
  typing: strings.questionFill,
  choice: strings.questionChoose,
  context: strings.questionChoose,
  transform: strings.questionTransform,
  reorder: strings.questionReorder,
  'error-correction': strings.questionCorrect,
};

/**
 * Working through a topic's exercises.
 *
 * Every answer ends on the explanation, right or wrong: a learner who guessed
 * correctly has learned nothing until they read why, and one who got it wrong
 * needs it most. That is the whole difference between a grammar exercise and a
 * quiz question.
 */
export default function GrammarPracticeScreen() {
  const router = useRouter();
  const { topicId } = useLocalSearchParams<{ topicId: string }>();
  const { repository } = useCourse();
  const { records, ready, save } = useProgress();

  const topic = repository.topic(decodeURIComponent(String(topicId ?? '')));
  const [practice, setPractice] = useState<GrammarPractice | null>(null);
  const [outcome, setOutcome] = useState<GrammarOutcome | null>(null);
  const [typed, setTyped] = useState('');
  const [tokens, setTokens] = useState<string[]>([]);
  const [hintShown, setHintShown] = useState(false);
  const [, bump] = useState(0);

  useEffect(() => {
    if (!ready || practice || !topic) return;
    setPractice(GrammarPractice.forTopic(LOCAL_USER, topic, records, { limit: 10 }));
    // Built once, from the progress as it stood when the screen opened.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, practice, topic]);

  const check = useCallback(async (given: string) => {
    if (!practice || outcome) return;
    const result = practice.answer(given, { hintShown });
    setOutcome(result);
    await save(result.progress, result.attempt);
  }, [practice, outcome, hintShown, save]);

  const advance = useCallback(() => {
    setOutcome(null);
    setTyped('');
    setTokens([]);
    setHintShown(false);
    bump((n) => n + 1);
  }, []);

  if (!topic) {
    return <Screen><Text style={styles.muted}>{strings.searchNoResults}</Text></Screen>;
  }
  if (!practice) {
    return <Screen><Text style={styles.muted}>{strings.loading}</Text></Screen>;
  }

  if (practice.finished && !outcome) {
    const summary = practice.summary;
    return (
      <Screen>
        <Stack.Screen options={{ title: '' }} />
        <View style={styles.centre}>
          <Text style={styles.summaryTitle}>{strings.grammarDone}</Text>
          <Text style={styles.muted}>{strings.grammarExercises(summary.asked)}</Text>
          <Text style={styles.muted}>
            {strings.sessionAccuracy(Math.round(summary.accuracy * 100))}
          </Text>
          <PrimaryButton label={strings.backToLessons} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const question = outcome ? null : practice.current;
  const position = practice.position;
  const isReorder = question?.kind === 'reorder';

  return (
    <Screen>
      <Stack.Screen options={{ title: topic.title }} />
      <KeyboardAvoidingView
        style={styles.flex}
        behavior={Platform.OS === 'ios' ? 'padding' : undefined}
      >
        <ProgressBar value={position.total === 0 ? 0 : position.index / position.total} />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {outcome ? (
            <>
              <Card
                tone={outcome.verdict.correct ? 'correct' : outcome.verdict.close ? 'almost' : 'wrong'}
                style={styles.block}
              >
                <Text style={styles.verdict}>
                  {outcome.verdict.correct
                    ? strings.correct
                    : outcome.verdict.close ? strings.almost : strings.wrong}
                </Text>
                {!outcome.verdict.correct ? (
                  <Text style={styles.body}>
                    {strings.theAnswerWas} {outcome.verdict.matched}
                  </Text>
                ) : null}
              </Card>
              {outcome.explanation ? (
                <Card style={styles.block}>
                  <Text style={styles.body}>{outcome.explanation}</Text>
                </Card>
              ) : null}
            </>
          ) : question ? (
            <>
              <Text style={styles.prompt}>
                {question.prompt || PROMPTS[question.kind] || strings.questionFill}
              </Text>
              {question.text ? <Text style={styles.sentence}>{question.text}</Text> : null}
              {!question.fromSource ? (
                <Text style={styles.provenance}>{strings.grammarWrittenForPractice}</Text>
              ) : null}

              {question.kind === 'choice' || question.kind === 'context' ? (
                <View style={styles.options}>
                  {question.options.map((option) => (
                    <Pressable
                      key={option}
                      accessibilityRole="button"
                      onPress={() => { void check(option); }}
                      style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
                    >
                      <Text style={styles.optionLabel}>{option}</Text>
                    </Pressable>
                  ))}
                </View>
              ) : isReorder ? (
                <>
                  <Card style={styles.assembled}>
                    <Text style={styles.body}>
                      {tokens.map((entry) => entry.split(':').slice(1).join(':')).join(' ') || ' '}
                    </Text>
                  </Card>
                  <View style={styles.tokens}>
                    {question.options.map((token, index) => {
                      const key = `${index}:${token}`;
                      if (tokens.includes(key)) return null;
                      return (
                        <Pressable
                          key={key}
                          accessibilityRole="button"
                          onPress={() => setTokens((current) => [...current, key])}
                          style={styles.token}
                        >
                          <Text style={styles.optionLabel}>{token}</Text>
                        </Pressable>
                      );
                    })}
                  </View>
                  <PrimaryButton
                    label={strings.check}
                    disabled={tokens.length === 0}
                    onPress={() => {
                      void check(tokens.map((entry) => entry.split(':').slice(1).join(':')).join(' '));
                    }}
                  />
                  {tokens.length > 0 ? (
                    <PrimaryButton
                      label={strings.profileResetCancel}
                      tone="quiet"
                      onPress={() => setTokens([])}
                    />
                  ) : null}
                </>
              ) : (
                <>
                  <TextInput
                    style={styles.input}
                    value={typed}
                    onChangeText={setTyped}
                    placeholder={strings.answerPlaceholder}
                    placeholderTextColor={palette.textMuted}
                    autoCapitalize="none"
                    autoCorrect={false}
                    autoFocus
                    returnKeyType="done"
                    onSubmitEditing={() => { void check(typed); }}
                  />
                  {hintShown && question.hint ? (
                    <Text style={styles.hint}>{question.hint}</Text>
                  ) : null}
                  <PrimaryButton
                    label={strings.check}
                    disabled={typed.trim().length === 0}
                    onPress={() => { void check(typed); }}
                  />
                  {question.hint && !hintShown ? (
                    <PrimaryButton
                      label={strings.showHint}
                      tone="quiet"
                      onPress={() => setHintShown(true)}
                    />
                  ) : null}
                </>
              )}
            </>
          ) : null}
        </ScrollView>

        <View style={styles.footer}>
          {outcome ? (
            <PrimaryButton label={strings.next} onPress={advance} />
          ) : (
            <PrimaryButton
              label={strings.skip}
              tone="quiet"
              onPress={() => { practice.skip(); advance(); }}
            />
          )}
        </View>
      </KeyboardAvoidingView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  centre: { flex: 1, justifyContent: 'center', gap: spacing.md },
  muted: { ...typeScale.body, color: palette.textMuted },
  prompt: { ...typeScale.caption, color: palette.textMuted },
  sentence: { ...typeScale.title, color: palette.text, lineHeight: 30 },
  provenance: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
  options: { gap: spacing.sm },
  option: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
  },
  optionPressed: { backgroundColor: palette.accentSoft },
  optionLabel: { ...typeScale.body, color: palette.text },
  assembled: { minHeight: 56, justifyContent: 'center' },
  tokens: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.sm },
  token: {
    backgroundColor: palette.accentSoft,
    borderRadius: radius.sm,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  input: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
    fontSize: 18,
    color: palette.text,
  },
  hint: { ...typeScale.caption, color: palette.almost },
  block: { gap: spacing.sm },
  verdict: { ...typeScale.heading, color: palette.text },
  body: { ...typeScale.body, color: palette.text, lineHeight: 23 },
  footer: { paddingVertical: spacing.md, gap: spacing.sm },
  summaryTitle: { ...typeScale.display, color: palette.text },
});
