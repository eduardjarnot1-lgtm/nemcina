import { StyleSheet, Text } from 'react-native';
import { palette, spacing, type as typeScale } from '../theme';
import { Animated, useEntrance } from '../motion';

/**
 * A screen with nothing on it, on purpose.
 *
 * An empty result and a broken screen look identical when both are blank, so
 * this says which one it is. It fades in keyed on its own message, which means
 * changing a search from one term with no hits to another also with no hits
 * re-announces itself rather than sitting there looking stuck.
 *
 * Deliberately quiet: no mascot, no illustration, no suggestion to try
 * something else. A learner who searched for a word that is not in the course
 * needs to know that fact, not to be entertained about it.
 */
export function EmptyState({ message }: { message: string }) {
  const entrance = useEntrance(message);
  return <Animated.Text style={[styles.message, entrance]}>{message}</Animated.Text>;
}

const styles = StyleSheet.create({
  message: {
    ...typeScale.caption,
    color: palette.textMuted,
    paddingVertical: spacing.lg,
  },
});
