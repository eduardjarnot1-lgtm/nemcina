import { useEffect, useRef } from 'react';
import { StyleSheet, View, type ViewStyle } from 'react-native';
import { palette, radius, spacing } from '../theme';
import { Animated, duration, easing, useReducedMotion } from '../motion';

/**
 * The shape of the content, while the content is not there yet.
 *
 * A blank screen and a centred spinner both say the same thing — "wait" —
 * without saying what for. Blocks in the shape of what is coming say how much
 * is coming and where it will be, so the screen does not jump when it lands.
 *
 * The shimmer is opacity only, so it costs a composite rather than a layout
 * pass, and it stops entirely under reduced motion: the blocks are still
 * visible and still explain the wait without moving.
 */
export function Skeleton({ lines = 3, style }: { lines?: number; style?: ViewStyle }) {
  const reduced = useReducedMotion();
  const shimmer = useRef(new Animated.Value(0.5)).current;

  useEffect(() => {
    if (reduced) return;
    const loop = Animated.loop(Animated.sequence([
      Animated.timing(shimmer, {
        toValue: 1, duration: duration.celebration, easing: easing.standard, useNativeDriver: true,
      }),
      Animated.timing(shimmer, {
        toValue: 0.5, duration: duration.celebration, easing: easing.standard, useNativeDriver: true,
      }),
    ]));
    loop.start();
    return () => loop.stop();
  }, [reduced, shimmer]);

  return (
    <View style={[styles.stack, style]} accessibilityRole="progressbar">
      {Array.from({ length: lines }, (_, index) => (
        <Animated.View
          key={index}
          style={[
            styles.block,
            // The last block is short, the way a last line of text is. Equal
            // bars read as a loading widget; unequal ones read as content.
            index === lines - 1 && styles.short,
            { opacity: shimmer },
          ]}
        />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  block: {
    height: 18,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
  },
  short: { width: '55%' },
});
