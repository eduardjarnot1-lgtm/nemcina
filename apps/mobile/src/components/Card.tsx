import type { ReactNode } from 'react';
import { Pressable, StyleSheet, View, type StyleProp, type ViewStyle } from 'react-native';
import { palette, radius, spacing } from '../theme';
import { Animated, usePressScale } from '../motion';

export function Card({
  children, onPress, style, tone = 'plain',
}: {
  children: ReactNode;
  onPress?: () => void;
  style?: StyleProp<ViewStyle>;
  tone?: 'plain' | 'accent' | 'correct' | 'wrong' | 'almost';
}) {
  const press = usePressScale(0.985);
  const toneStyle = tone === 'plain' ? undefined : styles[tone];
  const content = <View style={[styles.card, toneStyle, style]}>{children}</View>;
  if (!onPress) return content;
  // A tappable card gets the same press response as a button, a touch softer:
  // it is a bigger surface, so the same scale would read as the whole screen
  // moving. Cards that do nothing when tapped stay still, as they should.
  return (
    <Animated.View style={press.style}>
      <Pressable
        onPressIn={press.onPressIn}
        onPressOut={press.onPressOut}
        onPress={onPress}
        style={({ pressed }) => pressed && styles.pressed}
      >
        {content}
      </Pressable>
    </Animated.View>
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
