import { useCallback } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { isStreakMilestone } from '@nemcina/core';
import { strings } from '../strings';
import { palette, spacing, type as typeScale } from '../theme';
import { Animated, duration, useCountUp, useEarned, usePulse } from '../motion';
import { haptic } from '../haptics';

/**
 * Milestones worth marking, and nothing between them.
 *
 * A streak that celebrates every single day trains a learner to ignore it by
 * the second week. These are far enough apart that reaching one still means
 * something, and the gaps between them are deliberately silent.
 */


// The same list Fuka reacts to, from the engine. Kept in one place because
// two would drift, and the drift would show as the guide celebrating a day the
// number beside him did not.
const isMilestone = isStreakMilestone;

/**
 * The streak, counting up, pulsing only on the days that matter.
 *
 * The number is derived from review times rather than stored, so it cannot
 * claim a day the learner did not study — which is the only reason it is worth
 * drawing attention to at all. Nothing here threatens the learner with losing
 * it; a streak is a record of work done, not a debt.
 */
export function StreakRow({ days, longest }: { days: number; longest: number }) {
  const { pulse, style } = usePulse('strong');
  const shown = useCountUp(days, { duration: duration.normal });

  const celebrate = useCallback(() => {
    pulse();
    haptic('achievement');
  }, [pulse]);
  useEarned(isMilestone(days), celebrate);

  return (
    <View style={styles.row}>
      <Text style={styles.label}>{strings.streak}</Text>
      <View style={styles.values}>
        <Animated.Text style={[styles.value, isMilestone(days) && styles.milestone, style]}>
          {shown}
        </Animated.Text>
        {/* The longest run is shown only once it is genuinely behind the
            current one. Printing "best: 4" beside a streak of 4 is noise. */}
        {longest > days ? (
          <Text style={styles.best}>{strings.streakBest(longest)}</Text>
        ) : null}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: {
    flexDirection: 'row',
    justifyContent: 'space-between',
    alignItems: 'center',
    paddingVertical: spacing.xs,
  },
  label: { ...typeScale.body, color: palette.textMuted },
  values: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  value: { ...typeScale.body, color: palette.text, fontWeight: '600' },
  milestone: { color: palette.accent },
  best: { ...typeScale.caption, color: palette.textMuted },
});
