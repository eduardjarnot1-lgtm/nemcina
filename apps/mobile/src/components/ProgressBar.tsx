import { StyleSheet, View } from 'react-native';
import { palette, radius } from '../theme';
import { Animated, useProgressScale } from '../motion';

/**
 * `value` is 0–1; anything outside is clamped rather than drawn off the end.
 *
 * The fill is laid out at full width and scaled horizontally, so moving it
 * costs a composite rather than a layout pass. It travels to its new value —
 * seeing the bar move is how an answer becomes visible progress.
 */
export function ProgressBar({ value, tone = palette.accent }: { value: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const scale = useProgressScale(clamped);

  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={styles.track}
    >
      <Animated.View
        style={[
          styles.fill,
          { backgroundColor: tone, transform: [{ scaleX: scale }] },
        ]}
      />
    </View>
  );
}

const styles = StyleSheet.create({
  track: {
    height: 8,
    borderRadius: radius.sm,
    backgroundColor: palette.border,
    overflow: 'hidden',
  },
  // Anchored left so scaleX grows from the start of the track, not its middle.
  fill: { height: '100%', width: '100%', borderRadius: radius.sm, transformOrigin: 'left' },
});
