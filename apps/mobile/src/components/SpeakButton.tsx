import { useEffect, useState } from 'react';
import { Pressable, StyleSheet, Text } from 'react-native';
import { germanAvailable, speakGerman } from '../speech';
import { palette, radius, spacing, type as typeScale } from '../theme';

/**
 * Hear the word.
 *
 * Renders nothing at all when the device has no German voice — a control that
 * silently does nothing teaches people to distrust the others.
 */
export function SpeakButton({ text, label = '▶' }: { text: string; label?: string }) {
  const [available, setAvailable] = useState(false);

  useEffect(() => {
    let cancelled = false;
    void germanAvailable().then((can) => { if (!cancelled) setAvailable(can); });
    return () => { cancelled = true; };
  }, []);

  if (!available || !text.trim()) return null;

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityLabel={`Say ${text}`}
      onPress={() => { void speakGerman(text); }}
      style={({ pressed }) => [styles.button, pressed && styles.pressed]}
    >
      <Text style={styles.label}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  button: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    backgroundColor: palette.accentSoft,
    alignSelf: 'flex-start',
  },
  pressed: { opacity: 0.6 },
  label: { ...typeScale.label, color: palette.accent },
});
