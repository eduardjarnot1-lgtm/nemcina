import { StyleSheet, Text, View } from 'react-native';
import type { GrammarExample } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';

/**
 * One sentence, immediately.
 *
 * The page used to open with a summary, then a rule card, then a pattern, then
 * a paradigm — four blocks of description before a single word of German. The
 * quickest way to say what a construction is is to show one doing its job, so
 * one example is lifted to the top, set larger than the list further down and
 * paired with its English.
 *
 * It is the *shortest* example carrying a translation rather than the first
 * one, because the first is whichever the source happened to print and a first
 * meeting wants the clearest instance, not an arbitrary one.
 *
 * No highlighting here on purpose. The marks downstairs point at the form being
 * taught, which is a claim the learner cannot read yet at this point on the
 * page; this card only has to show that the thing exists and means something.
 */
export function LeadExample({ example }: { example: GrammarExample }) {
  return (
    <View style={styles.card}>
      <Text style={styles.de} selectable>{example.text}</Text>
      {example.en ? <Text style={styles.en}>{example.en}</Text> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  card: {
    gap: spacing.xs,
    backgroundColor: palette.accentSoft,
    borderRadius: radius.md,
    paddingVertical: spacing.md,
    paddingHorizontal: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.accent,
  },
  de: { ...typeScale.heading, color: palette.text, lineHeight: 28 },
  en: { ...typeScale.body, color: palette.textSecond, fontStyle: 'italic' },
});
