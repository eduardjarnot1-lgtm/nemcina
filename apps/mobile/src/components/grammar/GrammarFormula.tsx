import { StyleSheet, Text, View } from 'react-native';
import type { GrammarFormula as Formula } from '@nemcina/core';
import { roleTone } from '../../grammarTheme';
import { palette, radius, spacing, type as typeScale } from '../../theme';

/**
 * The shape of a construction, as a row of slots.
 *
 * `weil + Subject + … + Verb` is the same claim as "the conjugated verb moves
 * to the end of the clause", in the form the claim actually has. The rule stays
 * in the rules card; this is the picture of it, and a learner scanning the page
 * gets the pattern before reading a sentence of prose.
 *
 * Written by hand in `formulas.json`, never derived: deriving a pattern needs a
 * parser, and a wrong pattern teaches wrong grammar. A topic whose construction
 * is not schematic carries none rather than a forced one.
 *
 * The slot colours are the same four the example highlights use, so the amber
 * `weil` in the formula and the amber `weil` in the sentence below it are
 * visibly the same claim. A caption names each variant, so the colour is never
 * the only thing distinguishing "the condition first" from "the condition
 * second", and the slots wrap rather than scroll — a pattern you have to drag
 * sideways to finish reading is not a picture of anything.
 *
 * **Where a worked sentence exists, the pattern is laid out down the page
 * instead of across it.** The pattern and a real sentence were always both on
 * this page and never connected: `weil + Subject + … + Verb` in one card,
 * `…, weil er dort keine Sprachprobleme hat.` in another, and nothing saying
 * which word was the Verb. A learner had to do that matching themselves, which
 * is the one step they cannot do yet — it is what they came to learn.
 *
 * Laid across, the pairs wrapped mid-pattern on a 390-point screen and the
 * reading order stopped being obvious. Down the page each position gets a
 * numbered row — label on the left, the words that fill it on the right — and
 * for a topic about *word order* the numbering is not decoration: position is
 * the entire lesson, and a number says it where a colour cannot.
 */
export function GrammarFormula({ formulas }: { formulas: readonly Formula[] }) {
  return (
    <View style={styles.stack}>
      {formulas.map((formula, index) => (
        <View key={index} style={styles.formula}>
          {formula.sentence.length > 0 ? (
            <View style={styles.aligned}>
              {formula.slots.map((slot, at) => (
                <View key={at} style={styles.alignedRow}>
                  <Text style={styles.position}>{at + 1}</Text>
                  <Text style={[styles.slot, styles.alignedSlot, slot.role ? {
                    color: roleTone[slot.role].ink,
                    backgroundColor: roleTone[slot.role].wash,
                  } : styles.placeholder]}>
                    {slot.text}
                  </Text>
                  <Text style={styles.word} selectable>{formula.sentence[at]}</Text>
                </View>
              ))}
            </View>
          ) : (
            <View style={styles.row}>
              {formula.slots.map((slot, at) => (
                <View key={at} style={styles.slotRow}>
                  {at > 0 ? <Text style={styles.plus}>+</Text> : null}
                  <Text style={[styles.slot, slot.role ? {
                    color: roleTone[slot.role].ink,
                    backgroundColor: roleTone[slot.role].wash,
                  } : styles.placeholder]}>
                    {slot.text}
                  </Text>
                </View>
              ))}
            </View>
          )}
          {formula.sentence.length > 0 ? (
            <Text style={styles.sentenceEn}>{formula.sentenceEn}</Text>
          ) : null}
          {formula.caption ? <Text style={styles.caption}>{formula.caption}</Text> : null}
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  formula: { gap: spacing.xs },
  row: { flexDirection: 'row', flexWrap: 'wrap', alignItems: 'center', gap: 2 },
  slotRow: { flexDirection: 'row', alignItems: 'center' },
  aligned: { gap: spacing.xs },
  alignedRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  position: {
    ...typeScale.caption,
    color: palette.textMuted,
    minWidth: 14,
    textAlign: 'right',
    fontVariant: ['tabular-nums'],
  },
  alignedSlot: { minWidth: 104 },
  word: {
    ...typeScale.body,
    fontSize: 15,
    color: palette.text,
    flex: 1,
  },
  sentenceEn: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
  plus: {
    ...typeScale.caption,
    color: palette.textMuted,
    paddingHorizontal: spacing.xs,
    paddingVertical: 5,
  },
  slot: {
    ...typeScale.caption,
    fontSize: 14,
    fontWeight: '600',
    paddingHorizontal: spacing.sm,
    paddingVertical: 5,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  placeholder: { color: palette.textSecond, backgroundColor: palette.background },
  caption: { ...typeScale.caption, color: palette.textMuted, lineHeight: 19 },
});
