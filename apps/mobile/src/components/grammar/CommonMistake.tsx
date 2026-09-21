import { StyleSheet, Text, View } from 'react-native';
import type { Exercise } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * The mistake this topic's own exercise asks you to correct, shown worked.
 *
 * The corpus carries an error-correction exercise for 89 of its 136 topics:
 * a wrong sentence, its correction, and one line saying why. That is exactly
 * the thing a learner wants before practising — "here is what people get wrong
 * here" — and it is real content, not a pattern invented to fill a component.
 *
 * **It is shown closed.** This is one of the topic's own exercises, and opening
 * it gives away that one answer. Behind a control the learner chooses, that is
 * a fair trade: reading a worked mistake before practice is how a textbook
 * teaches, and the practice set has several other items. Putting it on the page
 * open would have spent the answer without asking.
 *
 * Right and wrong are marked by a word, a symbol and a colour together, never
 * by colour alone.
 */
export function CommonMistake({ exercise }: { exercise: Exercise }) {
  const corrected = exercise.answers[0] ?? '';
  return (
    <View style={styles.stack}>
      <View style={styles.line}>
        <Text style={[styles.mark, styles.wrongMark]} accessibilityLabel={strings.grammarWrong}>✕</Text>
        <Text style={[styles.sentence, styles.wrongText]} selectable>{exercise.text}</Text>
      </View>
      <View style={styles.line}>
        <Text style={[styles.mark, styles.rightMark]} accessibilityLabel={strings.grammarRight}>✓</Text>
        <Text style={[styles.sentence, styles.rightText]} selectable>{corrected}</Text>
      </View>
      {exercise.explanation ? (
        <Text style={styles.why}>{exercise.explanation}</Text>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.xs },
  line: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  mark: { ...typeScale.body, fontWeight: '700', width: 18, lineHeight: 23 },
  wrongMark: { color: palette.wrong },
  rightMark: { color: palette.correct },
  sentence: {
    ...typeScale.body,
    flex: 1,
    lineHeight: 23,
    paddingHorizontal: spacing.sm,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  wrongText: { color: palette.text, backgroundColor: palette.wrongSoft },
  rightText: { color: palette.text, backgroundColor: palette.correctSoft },
  why: { ...typeScale.caption, color: palette.textMuted, paddingTop: 2, lineHeight: 19 },
});
