import { StyleSheet, Text } from 'react-native';
import { strings } from '../strings';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { Animated, useEntrance } from '../motion';

/** Below this a run is not yet a run, and saying so would be flattery. */
const FLOOR = 3;

/**
 * A run of correct answers, shown while it lasts.
 *
 * This is the smallest reward in the app and it is meant to stay that way: no
 * haptic, no sound, no pulse, and nothing that moves while the learner is
 * reading a question. It appears, it counts, and it disappears the moment an
 * answer is wrong — which is the whole point. It marks concentration rather
 * than achievement, so it must never compete with the answer feedback beside
 * it, and it never blocks or delays anything.
 *
 * Nothing about the lesson depends on it. Remove this component and the
 * learning is identical.
 */
export function ComboBadge({ run }: { run: number }) {
  // Keyed on the number so it re-enters as it climbs, rather than the digit
  // silently swapping underneath.
  const entrance = useEntrance(run);
  if (run < FLOOR) return null;
  return (
    <Animated.Text style={[styles.badge, entrance]}>{strings.combo(run)}</Animated.Text>
  );
}

const styles = StyleSheet.create({
  badge: {
    ...typeScale.label,
    color: palette.accent,
    backgroundColor: palette.accentSoft,
    alignSelf: 'flex-start',
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
