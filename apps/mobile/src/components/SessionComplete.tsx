import { useEffect, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import type { SessionSummary } from '@nemcina/core';
import { PrimaryButton } from './PrimaryButton';
import { ProgressBar } from './ProgressBar';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { Animated, duration, useCountUp, useEntrance, useReducedMotion } from '../motion';
import { haptic } from '../haptics';
import { Mascot } from './Mascot';
import { mascotLine, sessionMoment } from '@nemcina/core';
import { strings } from '../strings';

/**
 * The end of a session.
 *
 * Three jobs, in order: say it is finished, show what the work produced, and
 * make the next thing obvious. The parts arrive staggered rather than at once,
 * which is what makes it read as an arrival instead of a screen swap — but the
 * whole sequence is under a second and the button is live from the first frame,
 * so nobody is ever waiting on it to leave.
 *
 * The strength of the reward is not fixed. A perfect session gets a different
 * headline and a stronger haptic than an ordinary one, because a celebration
 * that fires identically every time stops meaning anything by the third lesson.
 */
/**
 * What comes after this lesson, when there is one (§32).
 *
 * `topicDone` is content covered, not mastery. A topic whose words are still
 * owed to the scheduler is not finished in any sense the learner should be told
 * about, so the note alongside it reports the review debt rather than hiding it
 * behind a tick.
 */
export interface NextUp {
  readonly title: string;
  readonly kicker: string;
  readonly onPress: () => void;
  /** Set when this lesson finished off its whole topic. */
  readonly topicDone?: { readonly name: string; readonly note: string };
}

export function SessionComplete({
  summary, onDone, next,
}: { summary: SessionSummary; onDone: () => void; next?: NextUp | null }) {
  const reduced = useReducedMotion();
  const accuracy = Math.round(summary.accuracy * 100);
  // "Perfect" has to be earned: everything right, and enough asked for it to
  // mean something. Two-for-two is not a perfect lesson.
  const perfect = summary.itemsStudied >= 4 && summary.incorrect === 0 && accuracy === 100;

  const title = useEntrance('title');
  const stats = useEntrance('stats', { delay: reduced ? 0 : 120 });
  const action = useEntrance('action', { delay: reduced ? 0 : 240 });

  // Decided from the summary the screen already has, by the same rule the
  // screen uses for `perfect` — one place, so the two cannot disagree about
  // what just happened.
  const [milo] = useState(() => mascotLine(sessionMoment({
    itemsStudied: summary.itemsStudied,
    incorrect: summary.incorrect,
    accuracy: summary.accuracy,
  })));

  const studied = useCountUp(summary.itemsStudied, { duration: duration.celebration });
  const percent = useCountUp(accuracy, { duration: duration.celebration });

  useEffect(() => {
    haptic(perfect ? 'achievement' : 'success');
  }, [perfect]);

  return (
    <View style={styles.centre}>
      <Animated.View style={title}>
        <Text style={styles.title}>
          {perfect ? strings.sessionPerfect : strings.sessionDone}
        </Text>
        {perfect ? <Text style={styles.perfectNote}>{strings.sessionPerfectNote}</Text> : null}
      </Animated.View>

      {/* After the numbers, not before: the result is the news and he is the
          reaction to it. He waits for the stats to land. */}
      <Animated.View style={action}>
        <Mascot pose={milo.pose} line={milo.text} size="medium" />
      </Animated.View>

      <Animated.View style={[stats, styles.stats]}>
        {/* The sentences are the app's own, unchanged — only the numbers inside
            them count up. Reshaping these into a stat block would have animated
            nicely and quietly changed how the app talks to people. */}
        <Text style={styles.statLine}>{strings.sessionStudied(studied)}</Text>
        <Text style={styles.statLine}>{strings.sessionAccuracy(percent)}</Text>
        {/* The bar fills to the accuracy the number just counted to, so the two
            are the same fact rather than two decorations. */}
        <ProgressBar
          value={summary.accuracy}
          tone={perfect ? palette.correct : palette.accent}
        />
      </Animated.View>

      {next?.topicDone ? (
        <Animated.View style={[action, styles.topicDone]}>
          <Text style={styles.topicDoneTitle}>
            {strings.topicComplete(next.topicDone.name)}
          </Text>
          <Text style={styles.topicDoneNote}>{next.topicDone.note}</Text>
        </Animated.View>
      ) : null}

      <Animated.View style={action}>
        {next ? (
          <>
            {/* The recommendation is the primary action: a learner who has just
                finished something is the likeliest they will ever be to start
                the next thing, and sending them back to a list to find it is
                where that momentum goes. */}
            <PrimaryButton label={`${strings.thematicNext}: ${next.title}`} onPress={next.onPress} feel="selection" />
            <Text style={styles.nextKicker}>{next.kicker}</Text>
            <Text style={styles.backLink} onPress={onDone}>{strings.backToLessons}</Text>
          </>
        ) : (
          <PrimaryButton label={strings.backToLessons} onPress={onDone} feel="selection" />
        )}
      </Animated.View>
    </View>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, justifyContent: 'center', gap: spacing.lg },
  title: { ...typeScale.display, color: palette.text },
  perfectNote: { ...typeScale.caption, color: palette.correct, marginTop: spacing.xs },
  stats: {
    gap: spacing.sm,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
  },
  statLine: { ...typeScale.body, color: palette.text },
  topicDone: {
    gap: spacing.xs,
    backgroundColor: palette.goldSoft,
    borderRadius: radius.md,
    padding: spacing.md,
  },
  topicDoneTitle: { ...typeScale.heading, color: palette.goldInk },
  topicDoneNote: { ...typeScale.caption, color: palette.textSecond },
  nextKicker: { ...typeScale.caption, color: palette.textMuted, textAlign: 'center', marginTop: spacing.xs },
  backLink: { ...typeScale.label, color: palette.accent, textAlign: 'center', marginTop: spacing.sm },
});
