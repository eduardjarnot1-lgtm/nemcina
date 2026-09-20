import { useCallback, useEffect, useMemo, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
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
import { SpeakButton } from '../../src/components/SpeakButton';
import { AnswerOption } from '../../src/components/AnswerOption';
import { ComboBadge } from '../../src/components/ComboBadge';
import { Skeleton } from '../../src/components/Skeleton';
import { SessionComplete } from '../../src/components/SessionComplete';
import { Animated, useEntrance, usePulse, useShake } from '../../src/motion';
import { haptic } from '../../src/haptics';
import { useCourse } from '../../src/course';
import { LOCAL_USER, useProgress } from '../../src/progress';
import { usePreferences } from '../../src/preferences';
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
  const { preferences } = usePreferences();

  const [session, setSession] = useState<StudySession | null>(null);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [typed, setTyped] = useState('');
  const [hintShown, setHintShown] = useState(false);
  // Consecutive correct answers. Presentation only — the session's own queue,
  // grading and scheduling never read it.
  const [run, setRun] = useState(0);
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
    // The session is as long as the learner said a session should be. New
    // items stay a minority of it so review work is never crowded out.
    const total = preferences.dailyGoal;
    setSession(StudySession.plan(LOCAL_USER, plan.items, records, {
      pool: plan.pool,
      mix: { total, maxNew: Math.max(3, Math.round(total * 0.4)), maxMaintenance: 1 },
    }));
    // Same reason as above: built once, when progress has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, plan]);

  const check = useCallback(async (given: string) => {
    if (!session || outcome) return;
    const result = session.answer(given, { hintShown });
    setOutcome(result);
    // The feel goes out before the write: the learner should know the moment
    // they know, not once storage has caught up.
    haptic(result.verdict.correct ? 'success' : 'warning');
    setRun((previous) => (result.verdict.correct ? previous + 1 : 0));
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
        {/* The shape of a question, so the screen does not jump when the real
            one arrives a frame later. */}
        <View style={styles.loading}>
          <Skeleton lines={4} />
        </View>
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
    return (
      <Screen>
        <SessionComplete summary={session.summary} onDone={() => router.back()} />
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
        <ComboBadge run={run} />

        <ScrollView
          contentContainerStyle={styles.content}
          keyboardShouldPersistTaps="handled"
          showsVerticalScrollIndicator={false}
        >
          {outcome ? (
            <Feedback outcome={outcome} item={item} />
          ) : question ? (
            <QuestionBody questionKey={`${position.index}:${question.subject}`}>
              <Text style={styles.prompt}>{PROMPTS[question.kind]}</Text>
              <Text style={styles.subject}>{question.subject}</Text>
              {question.subjectTranslation ? (
                <Text style={styles.subjectTranslation}>{question.subjectTranslation}</Text>
              ) : null}

              {question.options.length > 0 ? (
                <View style={styles.options}>
                  {question.options.map((option) => (
                    <AnswerOption
                      key={option}
                      label={option}
                      disabled={Boolean(outcome)}
                      onPress={() => { void check(option); }}
                    />
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
            </QuestionBody>
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
 * Carries one question out and the next one in.
 *
 * Keyed on the question so it replays per question rather than per render. The
 * movement is small and the fade does the work: at speed a learner should see
 * the screen change, not watch something travel.
 */
function QuestionBody({
  questionKey, children,
}: { questionKey: string; children: ReactNode }) {
  const style = useEntrance(questionKey);
  return <Animated.View style={[styles.questionBody, style]}>{children}</Animated.View>;
}

/**
 * What happened, and why.
 *
 * A near miss is shown as a near miss rather than as a failure — the learner
 * knew the word and mistyped it, and telling them otherwise is both wrong and
 * discouraging.
 *
 * Correct pulses once; anything else shakes once, briefly. The shake is the
 * only "no" in the app and it is deliberately gentle: the card is already the
 * right colour and the correction is already on screen, so the movement only
 * has to catch the eye, not scold.
 */
function Feedback({
  outcome, item,
}: { outcome: AnswerOutcome; item: VocabularyItem | null }) {
  const tone = outcome.verdict.correct ? 'correct' : outcome.verdict.close ? 'almost' : 'wrong';
  const heading = outcome.verdict.correct
    ? strings.correct
    : outcome.verdict.close ? strings.almost : strings.wrong;

  const entrance = useEntrance(outcome.attempt.itemId + String(outcome.attempt.at));
  const { pulse, style: pulseStyle } = usePulse();
  const { shake, style: shakeStyle } = useShake();

  useEffect(() => {
    if (outcome.verdict.correct) pulse();
    else shake();
    // Once per outcome. `pulse`/`shake` are stable callbacks.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [outcome]);

  return (
    <Animated.View style={[entrance, pulseStyle, shakeStyle]}>
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
      {/* After the answer, never before: hearing the word first would give
          away every question that asks for it. */}
      {item ? (
        <SpeakButton
          text={item.metadata.article ? `${item.metadata.article} ${item.term}` : item.term}
        />
      ) : null}
    </Card>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  questionBody: { gap: spacing.md },
  flex: { flex: 1 },
  loading: { paddingVertical: spacing.lg },
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  centre: { flex: 1, justifyContent: 'center', gap: spacing.md },
  prompt: { ...typeScale.caption, color: palette.textMuted },
  subject: { ...typeScale.display, color: palette.text },
  subjectTranslation: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
  options: { gap: spacing.sm },
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
