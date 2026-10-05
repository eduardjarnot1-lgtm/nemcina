import { StyleSheet, Text, View } from 'react-native';
import type { GrammarWorked, GrammarWorkedSentence } from '@nemcina/core';
import { Collapsible } from './Collapsible';
import { MarkedText } from './MarkedText';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * Examples written to teach, each with the reason its form is correct.
 *
 * The topic's own examples come from the source document: they show the form in
 * use and stop there. A learner reading `den alten Mann` is shown the ending
 * and left to work out where it came from — which is the step they cannot take
 * yet, because it is the thing being taught.
 *
 * So each sentence here carries a *why*, and the whys are specific: "accusative
 * after a verb of seeing", not "because it is the accusative". A reason that
 * restates the rule is the rule again, and the rule is already on the page.
 *
 * **The first two stay visible, the rest fold away.** More examples help right
 * up to the point where the page stops being readable, and a learner meeting a
 * topic needs one clear instance before they need a fourth.
 *
 * **A wrong/right pair only where it earns its place.** It is shown with the
 * wrong form struck through and named as wrong in words, never by colour alone,
 * and it exists to answer the mistake a learner is actually about to make.
 */
export function WorkedExamples({ worked }: { worked: GrammarWorked }) {
  const open = worked.sentences.slice(0, 2);
  const rest = worked.sentences.slice(2);

  return (
    <View style={styles.stack}>
      {open.map((sentence, index) => <Worked key={index} sentence={sentence} />)}

      {rest.length > 0 ? (
        <Collapsible
          label={strings.grammarShowLess}
          collapsedLabel={strings.grammarMoreExamples(rest.length)}
        >
          <View style={styles.stack}>
            {rest.map((sentence, index) => <Worked key={index} sentence={sentence} />)}
          </View>
        </Collapsible>
      ) : null}

      {worked.contrast ? (
        <View style={styles.contrast}>
          <View style={styles.side}>
            <Text style={styles.sideLabel}>{strings.grammarWrong}</Text>
            <Text style={styles.wrong}>{worked.contrast.wrong}</Text>
          </View>
          <View style={styles.side}>
            <Text style={[styles.sideLabel, styles.rightLabel]}>{strings.grammarRight}</Text>
            <Text style={styles.right}>{worked.contrast.right}</Text>
          </View>
          <Text style={styles.contrastWhy}>{worked.contrast.why}</Text>
        </View>
      ) : null}
    </View>
  );
}

function Worked({ sentence }: { sentence: GrammarWorkedSentence }) {
  return (
    <View style={styles.item}>
      <MarkedText text={sentence.de} marks={sentence.marks} style={styles.de} />
      <Text style={styles.en}>{sentence.en}</Text>
      <Text style={styles.why}>{sentence.why}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  item: {
    gap: 2,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: palette.border,
  },
  de: { ...typeScale.body, color: palette.text, lineHeight: 24 },
  en: { ...typeScale.caption, fontSize: 14, fontStyle: 'italic', color: palette.textSecond },
  why: { ...typeScale.caption, color: palette.textMuted, lineHeight: 19 },

  contrast: {
    gap: spacing.xs,
    backgroundColor: palette.background,
    borderRadius: radius.sm,
    padding: spacing.sm,
    marginTop: spacing.xs,
  },
  side: { flexDirection: 'row', alignItems: 'baseline', gap: spacing.sm },
  sideLabel: { ...typeScale.label, color: palette.wrong, minWidth: 68 },
  rightLabel: { color: palette.correct },
  wrong: {
    ...typeScale.body, color: palette.wrong, flex: 1,
    textDecorationLine: 'line-through',
  },
  right: { ...typeScale.body, color: palette.text, flex: 1, fontWeight: '600' },
  contrastWhy: { ...typeScale.caption, color: palette.textSecond, lineHeight: 19, marginTop: 2 },
});
