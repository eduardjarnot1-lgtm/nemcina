import { useCallback, useEffect, useMemo, useState } from 'react';
import {
  KeyboardAvoidingView, Platform, Pressable, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  StudySession, isDue,
  type AnswerOutcome, type Question, type VocabularyItem,
} from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ProgressBar } from '../../src/components/ProgressBar';
import { useCourse } from '../../src/course';
import { LOCAL_USER, useProgress } from '../../src/progress';
import { strings } from '../../src/strings';
import { palette, radius, spacing, type as typeScale } from '../../src/theme';

/** The lesson id that means "everything the scheduler says is due", not a lesson. */
const REVIEW = 'review';

const PROMPTS: Record<Question['kind'], string> = {
  recognise: strings.questionRecognise,
  choice: strings.questionChoice,
  recall: strings.questionRecall,
  typing: strings.questionTyping,
  context: strings.questionContext,
  transform: strings.questionRecall,
  reorder: strings.questionRecall,
  'error-correction': strings.questionRecall,
};

export default function SessionScreen() {
  const router = useRouter();
  const { lessonId } = useLocalSearchParams<{ lessonId: string }>();
  const { repository, lessonsById } = useCourse();
  const { records, ready, save } = useProgress();

  const [session, setSession] = useState<StudySession | null>(null);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [typed, setTyped] = useState('');
  const [hintShown, setHintShown] = useState(false);
  // The session is a mutable object, so React has to be told when it moved.
  const [, bump] = useState(0);

  const plan = useMemo(() => {
    const id = decodeURIComponent(String(lessonId ?? ''));
    if (id === REVIEW) {
      const due = [...records.values()].filter((record) => isDue(record));
      const items = repository.items(due.map((record) => record.itemId));
      return { items, pool: repository.vocabulary() };
    }
    const lesson = lessonsById.get(id);
    if (!lesson) return { items: [] as readonly VocabularyItem[], pool: repository.vocabulary() };
    const items = repository.items(lesson.itemIds);
    // Distractors come from the whole level, not just the lesson: twelve words
    // would mean the same three wrong answers all the way through.
    const pool = lesson.level ? repository.vocabulary({ levels: [lesson.level] }) : repository.vocabulary();
    return { items, pool: pool.length >= 4 ? pool : repository.vocabulary() };
    // `records` is deliberately absent: the plan is made once, from the progress
    // as it stood when the session opened. Re-planning on every answer would
    // rewrite the queue underneath the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, lessonsById, repository]);

  useEffect(() => {
    if (!ready || session) return;
    setSession(StudySession.plan(LOCAL_USER, plan.items, records, { pool: plan.pool }));
    // Same reason as above: built once, when progress has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, plan]);

  const check = useCallback(async (given: string) => {
    if (!session || outcome) return;
    const result = session.answer(given, { hintShown });
    setOutcome(result);
    await save(result.progress, result.attempt);
  }, [session, outcome, hintShown, save]);

  const advance = useCallback(() => {
    setOutcome(null);
    setTyped('');
    setHintShown(false);
    bump((n) => n + 1);
  }, []);

  if (!session) {
    return (
      <Screen>
        <Text style={styles.loading}>{strings.loading}</Text>
      </Screen>
    );
  }

  if (plan.items.length === 0) {
    return (
      <Screen>
        <View style={styles.centre}>
          <Text style={styles.summaryLine}>{strings.dueNone}</Text>
          <PrimaryButton label={strings.backToLessons} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  if (session.finished && !outcome) {
    const summary = session.summary;
    return (
      <Screen>
        <View style={styles.centre}>
          <Text style={styles.summaryTitle}>{strings.sessionDone}</Text>
          <Text style={styles.summaryLine}>{strings.sessionStudied(summary.itemsStudied)}</Text>
          <Text style={styles.summaryLine}>
            {strings.sessionAccuracy(Math.round(summary.accuracy * 100))}
          </Text>
          <PrimaryButton label={strings.backToLessons} onPress={() => router.back()} />
        </View>
      </Screen>
    );
  }

  const question = outcome ? null : session.current;
  const item = session.currentItem;
  const position = session.position;

  return (
    <Screen>
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
            <Feedback outcome={outcome} />
          ) : question ? (
            <>
              <Text style={styles.prompt}>{PROMPTS[question.kind]}</Text>
              <Text style={styles.subject}>{question.subject}</Text>
              {question.subjectTranslation ? (
                <Text style={styles.subjectTranslation}>{question.subjectTranslation}</Text>
              ) : null}

              {question.options.length > 0 ? (
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

        {outcome ? (
          <View style={styles.footer}>
            <PrimaryButton label={strings.next} onPress={advance} />
          </View>
        ) : item ? (
          <View style={styles.footer}>
            <PrimaryButton
              label={strings.skip}
              tone="quiet"
              onPress={() => { session.skip(); advance(); }}
            />
          </View>
        ) : null}
      </KeyboardAvoidingView>
    </Screen>
  );
}

/**
 * What happened, and why.
 *
 * A near miss is shown as a near miss rather than as a failure — the learner
 * knew the word and mistyped it, and telling them otherwise is both wrong and
 * discouraging.
 */
function Feedback({ outcome }: { outcome: AnswerOutcome }) {
  const tone = outcome.verdict.correct ? 'correct' : outcome.verdict.close ? 'almost' : 'wrong';
  const heading = outcome.verdict.correct
    ? strings.correct
    : outcome.verdict.close ? strings.almost : strings.wrong;

  return (
    <Card tone={tone} style={styles.feedback}>
      <Text style={[styles.feedbackTitle, styles[`${tone}Text`]]}>{heading}</Text>
      {!outcome.verdict.correct ? (
        <Text style={styles.feedbackAnswer}>
          {strings.theAnswerWas} {outcome.verdict.matched}
        </Text>
      ) : null}
      {outcome.willRepeat ? (
        <Text style={styles.feedbackNote}>{strings.comesBackLater}</Text>
      ) : null}
    </Card>
  );
}

const styles = StyleSheet.create({
  flex: { flex: 1 },
  loading: { ...typeScale.caption, color: palette.textMuted, padding: spacing.md },
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  centre: { flex: 1, justifyContent: 'center', gap: spacing.md },
  prompt: { ...typeScale.caption, color: palette.textMuted },
  subject: { ...typeScale.display, color: palette.text },
  subjectTranslation: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
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
  footer: { paddingVertical: spacing.md, gap: spacing.sm },
  feedback: { gap: spacing.sm },
  feedbackTitle: { ...typeScale.title },
  feedbackAnswer: { ...typeScale.body, color: palette.text },
  feedbackNote: { ...typeScale.caption, color: palette.textMuted },
  correctText: { color: palette.correct },
  wrongText: { color: palette.wrong },
  almostText: { color: palette.almost },
  summaryTitle: { ...typeScale.display, color: palette.text },
  summaryLine: { ...typeScale.body, color: palette.textMuted },
});
