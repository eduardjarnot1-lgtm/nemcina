import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { Animated, usePressScale } from '../motion';
import { haptic } from '../haptics';

/**
 * One choice in a multiple-choice question.
 *
 * This app answers on a single tap rather than select-then-confirm, and that is
 * kept: a second tap on every question is a second tap a hundred times a
 * session. The moment of "it took my answer" is delivered instead by the press
 * itself — the scale and the haptic both fire on press-in, before the answer is
 * even checked, so the acknowledgement is never behind the work.
 */
export function AnswerOption({
  label, onPress, disabled = false,
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
}) {
  const press = usePressScale(0.98);

  return (
    <Animated.View style={press.style}>
      <Pressable
        accessibilityRole="button"
        disabled={disabled}
        onPressIn={() => {
          press.onPressIn();
          haptic('selection');
        }}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
      >
        <Text style={styles.optionLabel}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  option: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
  },
  optionPressed: { backgroundColor: palette.accentSoft, borderColor: palette.accent },
  optionLabel: { ...typeScale.body, color: palette.text },
});
