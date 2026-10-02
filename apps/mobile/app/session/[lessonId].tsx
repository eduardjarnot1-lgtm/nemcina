import { useCallback, useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import {
  KeyboardAvoidingView, Platform, ScrollView, StyleSheet, Text, TextInput, View,
} from 'react-native';
import { useLocalSearchParams, useRouter } from 'expo-router';
import {
  StudySession, clusterStatus, composeLesson, dueItemIds, isRunMilestone, mascotLine,
  nextCluster, vocabularyTopicProgress,
  type AnswerOutcome, type Question, type VocabularyCluster, type VocabularyItem,
} from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { ProgressBar } from '../../src/components/ProgressBar';
import { SpeakButton } from '../../src/components/SpeakButton';
import { AnswerOption } from '../../src/components/AnswerOption';
import { ComboBadge } from '../../src/components/ComboBadge';
import { Mascot } from '../../src/components/Mascot';
import { Skeleton } from '../../src/components/Skeleton';
import { track } from '../../src/analytics';
import { SessionComplete, type NextUp } from '../../src/components/SessionComplete';
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
  const { repository, clustersById, topicsById, clusters: allClusters } = useCourse();
  const { records, ready, save } = useProgress();
  const { preferences } = usePreferences();

  const [session, setSession] = useState<StudySession | null>(null);
  const [outcome, setOutcome] = useState<AnswerOutcome | null>(null);
  const [typed, setTyped] = useState('');
  const [hintShown, setHintShown] = useState(false);
  // Consecutive correct answers. Presentation only — the session's own queue,
  // grading and scheduling never read it.
  const [run, setRun] = useState(0);
  /**
   * Held until the run breaks or the next question replaces it, so the line
   * does not re-roll on every render while it is on screen.
   */
  const encouragement = useMemo(
    () => (isRunMilestone(run) ? mascotLine('encouragement') : null),
    [run],
  );
  // The session is a mutable object, so React has to be told when it moved.
  const [, bump] = useState(0);

  /**
   * What this session is made of.
   *
   * Two shapes, deliberately kept apart (§37). Mixed review is the scheduler's
   * own list and is *meant* to jump between topics — that is what makes it work
   * for long-term recall. A thematic lesson is one cluster plus a minority of
   * review, so it still reads as being about airports.
   */
  const plan = useMemo(() => {
    const id = decodeURIComponent(String(lessonId ?? ''));
    const everything = repository.vocabulary();

    if (id === REVIEW) {
      return {
        cluster: null as VocabularyCluster | null,
        items: repository.items(dueItemIds(records)),
        pool: everything,
        reviewCount: 0,
      };
    }

    const cluster = repository.cluster(id) ?? clustersById.get(id) ?? null;
    if (!cluster) {
      return { cluster, items: [] as readonly VocabularyItem[], pool: everything, reviewCount: 0 };
    }

    const clusterItems = repository.items(cluster.itemIds);
    const composition = composeLesson(
      cluster,
      clusterItems,
      everything,
      records,
      { mix: { target: preferences.dailyGoal, minReview: 3, maxReviewShare: 0.4 } },
    );

    // Distractors come from the whole level, not just the cluster: fifteen
    // airport words would mean the same three wrong answers all the way
    // through, and a learner can pass that by elimination without knowing any
    // of them.
    const levelPool = repository.vocabulary({ levels: [cluster.level] });
    return {
      cluster,
      items: repository.items(composition.itemIds),
      pool: levelPool.length >= 4 ? levelPool : everything,
      reviewCount: composition.reviewIds.length,
    };
    // `records` is deliberately absent from the deps: the plan is made once,
    // from the progress as it stood when the session opened. Re-planning on
    // every answer would rewrite the queue underneath the learner.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [lessonId, clustersById, repository, preferences.dailyGoal]);

  const topicTitle = plan.cluster
    ? topicsById.get(`${plan.cluster.level}/${plan.cluster.subcategory}`)?.title ?? ''
    : '';

  /**
   * What to offer at the end (§25, §32).
   *
   * Read from `records`, which by this point includes everything answered in
   * this session — so a lesson that completed its topic says so, and the
   * recommendation has already moved on to the next one.
   */
  const nextUp = useMemo((): NextUp | null => {
    const cluster = plan.cluster;
    if (!cluster) return null;
    const following = nextCluster(allClusters, cluster, records);
    if (!following) return null;

    const topic = topicsById.get(`${cluster.level}/${cluster.subcategory}`);
    const rolled = topic
      ? vocabularyTopicProgress(topic.clusters, records)[0] ?? null
      : null;
    const finished = topic
      && topic.clusters.every((entry) => clusterStatus(entry, records).complete);
    const due = topic
      ? topic.clusters.reduce((sum, entry) => sum + clusterStatus(entry, records).due, 0)
      : 0;

    const followingTopic = topicsById.get(`${following.level}/${following.subcategory}`);
    return {
      title: following.name,
      kicker: `${following.level}${followingTopic ? ` · ${followingTopic.title}` : ''}`,
      onPress: () => router.replace(`/session/${encodeURIComponent(following.id)}`),
      topicDone: finished && topic && rolled
        ? {
          name: topic.title,
          note: strings.topicCompleteNote(rolled.learned, rolled.mastered, due),
        }
        : undefined,
    };
  }, [plan.cluster, allClusters, records, topicsById, router]);

  // The funnel, recorded at the two moments that define it: a session that
  // began, and a session that did not reach its summary. `track` has no sink
  // installed, so none of this leaves the device — see src/analytics.ts.
  const started = useRef(false);
  const finishedRef = useRef(false);
  const answeredRef = useRef(0);
  const plannedRef = useRef(0);

  useEffect(() => () => {
    // On unmount: if the session began and never finished, it was abandoned.
    if (started.current && !finishedRef.current) {
      track({
        name: 'lesson_abandoned',
        answered: answeredRef.current,
        items: plannedRef.current,
      });
    }
  }, []);

  useEffect(() => {
    if (!ready || session) return;
    // The session is as long as the learner said a session should be. New
    // items stay a minority of it so review work is never crowded out.
    const total = preferences.dailyGoal;
    // `composeLesson` has already chosen the words and the thematic/review
    // balance. Handing the session a `maxNew` cap here would make it drop
    // thematic words — the ones the lesson is named after — so the mix is
    // opened up to exactly what was composed and the session's job is reduced
    // to ordering and choosing exercise forms.
    const planned = StudySession.plan(LOCAL_USER, plan.items, records, {
      pool: plan.pool,
      mix: plan.cluster
        ? { total: plan.items.length, maxNew: plan.items.length, maxMaintenance: plan.items.length }
        : { total, maxNew: Math.max(3, Math.round(total * 0.4)), maxMaintenance: 1 },
    });
    setSession(planned);
    started.current = true;
    plannedRef.current = planned.position.total;
    const id = decodeURIComponent(String(lessonId ?? ''));
    if (id === REVIEW) {
      track({ name: 'review_started', due: planned.position.total });
      track({ name: 'mixed_review_started', due: planned.position.total });
    } else {
      track({ name: 'lesson_started', lessonId: id, items: planned.position.total });
      if (plan.cluster) {
        track({
          name: 'thematic_lesson_started',
          clusterId: plan.cluster.id,
          topicWords: plan.items.length - plan.reviewCount,
          reviewWords: plan.reviewCount,
        });
      }
    }
    // Same reason as above: built once, when progress has loaded.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [ready, session, plan]);

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
    if (!session || outcome || answering.current) return;
    answering.current = true;
    const result = session.answer(given, { hintShown });
    setOutcome(result);
    // The feel goes out before the write: the learner should know the moment
    // they know, not once storage has caught up.
    haptic(result.verdict.correct ? 'success' : 'warning');
    setRun((previous) => (result.verdict.correct ? previous + 1 : 0));
    answeredRef.current += 1;
    await save(result.progress, result.attempt);
  }, [session, outcome, hintShown, save]);

  const advance = useCallback(() => {
    setOutcome(null);
    setTyped('');
    setHintShown(false);
    answering.current = false;
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
    if (!finishedRef.current) {
      finishedRef.current = true;
      track({
        name: 'lesson_completed',
        items: session.summary.itemsStudied,
        accuracy: session.summary.accuracy,
      });
      if (plan.cluster) {
        track({
          name: 'thematic_lesson_completed',
          clusterId: plan.cluster.id,
          items: session.summary.itemsStudied,
          accuracy: session.summary.accuracy,
        });
        // Fired from the same reading of `records` the completion screen uses,
        // so the event and what the learner is shown cannot disagree.
        if (nextUp?.topicDone) {
          track({
            name: 'subcategory_completed',
            level: plan.cluster.level,
            topic: plan.cluster.subcategory,
          });
        }
      }
    }
    return (
      <Screen>
        <SessionComplete summary={session.summary} onDone={() => router.back()} next={nextUp} />
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
        {/* What this lesson is (§10). A learner should know before the first
            question whether they are doing airports or a mixed review — the two
            ask for different kinds of attention, and the mixed one is supposed
            to jump about. The composition is stated too, so the review words
            are visibly the minority rather than an unexplained intrusion. */}
        <View style={styles.identity}>
          <Text style={styles.kicker}>
            {plan.cluster
              ? `${plan.cluster.level}${topicTitle && !plan.cluster.name.startsWith(topicTitle)
                ? ` · ${topicTitle.toUpperCase()}` : ''}`
              : strings.mixedReview.toUpperCase()}
          </Text>
          <Text style={styles.identityTitle}>
            {plan.cluster ? plan.cluster.name : strings.mixedReviewNote}
          </Text>
          {plan.cluster ? (
            <Text style={styles.identityMeta}>
              {strings.reviewMix(plan.items.length - plan.reviewCount, plan.reviewCount)}
            </Text>
          ) : null}
        </View>

        <ProgressBar value={position.total === 0 ? 0 : position.index / position.total} />
        <ComboBadge run={run} />

        {/* On a run of five, ten or twenty — and never on a single answer.
            The card is already the right colour and the pulse has already
            happened; a companion who comments on every correct answer is one
            people switch off by the second lesson. It sits above the question
            and disappears with the next one, so it never covers anything. */}
        {encouragement ? (
          <Mascot
            pose={encouragement.pose}
            line={encouragement.text}
            size="small"
            style={styles.encouragement}
          />
        ) : null}

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
  identity: { paddingBottom: spacing.sm, gap: 2 },
  kicker: { ...typeScale.label, color: palette.accent, letterSpacing: 0.5 },
  identityTitle: { ...typeScale.heading, color: palette.text },
  identityMeta: { ...typeScale.caption, color: palette.textMuted },
  encouragement: { marginBottom: spacing.xs },
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
