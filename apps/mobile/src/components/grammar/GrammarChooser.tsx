import { StyleSheet, Text, View } from 'react-native';
import type { GrammarChooser as Chooser } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * How to choose the right form.
 *
 * Every paradigm table in this app answers "what are the forms?". None of them
 * answered the question a learner actually has, which is: I am holding a
 * sentence, which of these sixteen cells is mine? For adjective endings that
 * question *is* the topic — the table has only two values in it, and knowing
 * them tells you nothing about which to write.
 *
 * So this is the walk, numbered: ask something, answer it from the sentence in
 * front of you, repeat. Then finished phrases taken apart, one reason per step
 * and in the same order, so the procedure is not just asserted but shown
 * working. The build refuses a worked example that skips a step, which is what
 * keeps the two halves in step with each other.
 *
 * The steps are numbered rather than coloured. A sequence is an ordering, and
 * an ordering is what a number says and a hue does not.
 */
export function GrammarChooser({ chooser }: { chooser: Chooser }) {
  return (
    <View style={styles.stack}>
      {chooser.title ? <Text style={styles.title}>{chooser.title}</Text> : null}

      <View style={styles.steps}>
        {chooser.steps.map((step, index) => (
          <View key={index} style={styles.step}>
            <View style={styles.number}>
              <Text style={styles.numberText}>{index + 1}</Text>
            </View>
            <View style={styles.stepBody}>
              <Text style={styles.ask}>{step.ask}</Text>
              <Text style={styles.how}>{step.how}</Text>
            </View>
          </View>
        ))}
      </View>

      {chooser.worked.length > 0 ? (
        <View style={styles.workedBlock}>
          <Text style={styles.sectionLabel}>{strings.grammarWorked}</Text>
          {chooser.worked.map((item) => (
            <View key={item.phrase} style={styles.worked}>
              <Text style={styles.phrase} selectable>{item.phrase}</Text>
              <Text style={styles.translation}>{item.translation}</Text>
              {item.because.map((line, index) => (
                <View key={index} style={styles.becauseRow}>
                  <Text style={styles.becauseIndex}>{index + 1}</Text>
                  <Text style={styles.because}>{line}</Text>
                </View>
              ))}
            </View>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.md },
  title: { ...typeScale.body, color: palette.text, lineHeight: 23 },
  steps: { gap: spacing.sm },
  step: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  number: {
    width: 24, height: 24, borderRadius: 12,
    backgroundColor: palette.accent,
    alignItems: 'center', justifyContent: 'center',
    marginTop: 1,
  },
  numberText: { ...typeScale.label, color: '#ffffff', fontWeight: '700' },
  stepBody: { flex: 1, gap: 2 },
  ask: { ...typeScale.body, fontWeight: '600', color: palette.text },
  how: { ...typeScale.caption, color: palette.textSecond, lineHeight: 19 },

  workedBlock: { gap: spacing.sm },
  sectionLabel: { ...typeScale.label, color: palette.textMuted, letterSpacing: 0.6 },
  worked: {
    gap: 3,
    backgroundColor: palette.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
  },
  phrase: { ...typeScale.body, fontWeight: '700', color: palette.text },
  translation: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
  becauseRow: { flexDirection: 'row', gap: spacing.xs, marginTop: 2 },
  becauseIndex: {
    ...typeScale.caption, color: palette.accent, fontWeight: '700', minWidth: 12,
  },
  because: { ...typeScale.caption, color: palette.textSecond, flex: 1, lineHeight: 19 },
});
