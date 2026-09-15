import { StyleSheet, View } from 'react-native';
import { palette, radius } from '../theme';

/** `value` is 0–1; anything outside is clamped rather than drawn off the end. */
export function ProgressBar({ value, tone = palette.accent }: { value: number; tone?: string }) {
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  return (
    <View
      accessibilityRole="progressbar"
      accessibilityValue={{ min: 0, max: 100, now: Math.round(clamped * 100) }}
      style={styles.track}
    >
      <View style={[styles.fill, { width: `${clamped * 100}%`, backgroundColor: tone }]} />
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
  fill: { height: '100%', borderRadius: radius.sm },
});
