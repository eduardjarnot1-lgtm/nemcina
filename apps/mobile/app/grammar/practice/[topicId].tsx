import { useCallback, useEffect, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter, Stack } from 'expo-router';
import { GrammarPractice, type ExerciseKind, type GrammarOutcome } from '@nemcina/core';
import { Screen } from '../../../src/components/Screen';
import { Card } from '../../../src/components/Card';
import { PrimaryButton } from '../../../src/components/PrimaryButton';
import { ProgressBar } from '../../../src/components/ProgressBar';
import { AnswerOption } from '../../../src/components/AnswerOption';
import { Skeleton } from '../../../src/components/Skeleton';
import { EmptyState } from '../../../src/components/EmptyState';
import { Animated, useEntrance, usePulse, useShake, usePressScale } from '../../../src/motion';
import { haptic } from '../../../src/haptics';
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

  // A tap is only allowed to spend a question once.
  //
  // `outcome` is React state, so two taps in the same tick both read it as
  // null. It has held so far only because two click events are two separate
  // tasks and React re-renders between them — protection by event-loop timing,
  // not by intent. The engine offers none of its own: calling `answer` twice
  // without showing the first outcome consumes two questions and records two
  // attempts, the second against a question nobody saw. A ref is synchronous,
  // so it closes the window whatever the scheduler does.
  const answering = useRef(false);

  const check = useCallback(async (given: string) => {
    if (!practice || outcome || answering.current) return;
    answering.current = true;
    const result = practice.answer(given, { hintShown });
    // Fired here rather than in the feedback card, so the acknowledgement lands
    // with the tap and not after the progress write. Same cue as a vocabulary
    // answer: one app, one meaning per feel.
    haptic(result.verdict.correct ? 'success' : 'warning');
    setOutcome(result);
    await save(result.progress, result.attempt);
  }, [practice, outcome, hintShown, save]);

  const advance = useCallback(() => {
    setOutcome(null);
    setTyped('');
    setTokens([]);
    setHintShown(false);
    answering.current = false;
    bump((n) => n + 1);
  }, []);

  if (!topic) {
    return <Screen><EmptyState message={strings.searchNoResults} /></Screen>;
  }
  if (!practice) {
    return <Screen><View style={styles.loading}><Skeleton lines={4} /></View></Screen>;
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
              <Verdict outcome={outcome} />
              {outcome.explanation ? (
                <QuestionBody questionKey={`why-${position.index}`}>
                  <Card style={styles.block}>
                    <Text style={styles.body}>{outcome.explanation}</Text>
                  </Card>
                </QuestionBody>
              ) : null}
            </>
          ) : question ? (
            <QuestionBody questionKey={`q-${position.index}`}>
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
                    <AnswerOption
                      key={option}
                      label={option}
                      onPress={() => { void check(option); }}
                    />
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
                        <Token
                          key={key}
                          label={token}
                          onPress={() => setTokens((current) => [...current, key])}
                        />
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
            </QuestionBody>
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

/**
 * The question, arriving.
 *
 * The same wrapper the vocabulary session uses, for the same reason: keyed on
 * the position so it replays per question and not per keystroke. Before this,
 * a grammar question was replaced by the next one between two frames, which is
 * the one moment in the flow where a learner needs to notice something changed.
 */
function QuestionBody({
  questionKey, children,
}: { questionKey: string; children: ReactNode }) {
  const style = useEntrance(questionKey);
  return <Animated.View style={[styles.questionBody, style]}>{children}</Animated.View>;
}

/**
 * Right, nearly, or not — as one card that reacts.
 *
 * Correct pulses once; anything else shakes once. Identical to the vocabulary
 * session on purpose: the two halves of this app ask the same learner the same
 * kind of question, and until now only one of them answered back. A near miss
 * still shakes rather than pulses, because it was not right — but the card is
 * already the amber "almost" and the wording already says so, so the movement
 * only has to catch the eye.
 */
function Verdict({ outcome }: { outcome: GrammarOutcome }) {
  const tone = outcome.verdict.correct ? 'correct' : outcome.verdict.close ? 'almost' : 'wrong';
  const entrance = useEntrance(outcome.attempt.itemId + String(outcome.attempt.at));
  const { pulse, style: pulseStyle } = usePulse();
  const { shake, style: shakeStyle } = useShake();

  useEffect(() => {
    if (outcome.verdict.correct) pulse();
    else shake();
    // Once per outcome. `pulse` and `shake` are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <Animated.View style={[entrance, pulseStyle, shakeStyle]}>
      <Card tone={tone} style={styles.block}>
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
    </Animated.View>
  );
}

/**
 * One word of a sentence being reassembled.
 *
 * A reorder question is the most tapping in the app — a whole sentence, one
 * word at a time — and its tokens were the only tappable thing left that did
 * not respond at all. The press scale is the shared one; the haptic is
 * `selection`, the same as picking an answer, because that is what it is.
 */
function Token({ label, onPress }: { label: string; onPress: () => void }) {
  const press = usePressScale(0.96);
  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        onPressIn={() => { press.onPressIn(); haptic('selection'); }}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={styles.token}
      >
        <Text style={styles.optionLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  questionBody: { gap: spacing.md },
  loading: { paddingVertical: spacing.lg },
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
