import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type ViewStyle } from 'react-native';
import { palette, radius, spacing } from '../theme';

export function Card({
  children, onPress, style, tone = 'plain',
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: ViewStyle;
  tone?: 'plain' | 'accent' | 'correct' | 'wrong' | 'almost';
}) {
  const toneStyle = tone === 'plain' ? undefined : styles[tone];
  const content = <View style={[styles.card, toneStyle, style]}>{children}</View>;
  if (!onPress) return content;
  return (
    <Pressable onPress={onPress} style={({ pressed }) => pressed && styles.pressed}>
      {content}
    </Pressable>
  );
}

const styles = StyleSheet.create({
  card: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
  },
  pressed: { opacity: 0.7 },
  accent: { backgroundColor: palette.accentSoft, borderColor: palette.accentSoft },
  correct: { backgroundColor: palette.correctSoft, borderColor: palette.correctSoft },
  wrong: { backgroundColor: palette.wrongSoft, borderColor: palette.wrongSoft },
  almost: { backgroundColor: palette.almostSoft, borderColor: palette.almostSoft },
});
