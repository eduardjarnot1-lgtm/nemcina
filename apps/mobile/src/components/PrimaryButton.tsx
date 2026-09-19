import { Animated, Pressable, StyleSheet, Text } from 'react-native';
import { palette, radius, spacing } from '../theme';
import { usePressScale } from '../motion';
import { haptic } from '../haptics';

/**
 * The button the learner presses most.
 *
 * It answers under the finger: the scale starts on press-in, before `onPress`
 * and before any work the handler does, so the app feels immediate even when
 * saving progress makes the next frame late.
 */
export function PrimaryButton({
  label, onPress, disabled = false, tone = 'accent', feel = 'selection',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'quiet';
  /** What pressing this means. `null` for the quiet ones that need no buzz. */
  feel?: 'selection' | 'success' | null;
}) {
  const press = usePressScale();

  return (
    <Animated.View style={disabled ? undefined : press.style}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ disabled }}
        disabled={disabled}
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={() => {
          if (feel) haptic(feel);
          onPress();
        }}
        style={({ pressed }) => [
          styles.button,
          tone === 'quiet' && styles.quiet,
          disabled && styles.disabled,
          pressed && !disabled && styles.pressed,
        ]}
      >
        <Text style={[styles.label, tone === 'quiet' && styles.quietLabel]}>{label}</Text>
      </Pressable>
    </Animated.View>
  );
}

const styles = StyleSheet.create({
  button: {
    backgroundColor: palette.accent,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.lg,
    alignItems: 'center',
  },
  quiet: { backgroundColor: 'transparent' },
  disabled: { opacity: 0.4 },
  pressed: { opacity: 0.9 },
  label: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  quietLabel: { color: palette.textMuted },
});
