import { Pressable, StyleSheet, Text } from 'react-native';
import { palette, radius, spacing } from '../theme';

export function PrimaryButton({
  label, onPress, disabled = false, tone = 'accent',
}: {
  label: string;
  onPress: () => void;
  disabled?: boolean;
  tone?: 'accent' | 'quiet';
}) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ disabled }}
      disabled={disabled}
      onPress={onPress}
      style={({ pressed }) => [
        styles.button,
        tone === 'quiet' && styles.quiet,
        disabled && styles.disabled,
        pressed && !disabled && styles.pressed,
      ]}
    >
      <Text style={[styles.label, tone === 'quiet' && styles.quietLabel]}>{label}</Text>
    </Pressable>
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
  pressed: { opacity: 0.8 },
  label: { color: '#ffffff', fontSize: 16, fontWeight: '600' },
  quietLabel: { color: palette.textMuted },
});
