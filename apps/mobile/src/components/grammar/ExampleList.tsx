import { StyleSheet, Text, View } from 'react-native';
import type { GrammarExample, GrammarMark, MarkRole } from '@nemcina/core';
import { roleTone } from '../../grammarTheme';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * The examples of a topic, with the forms it teaches picked out.
 *
 * **Three lines, three different things**, and they are not interchangeable:
 * the German; then the English, which was written for this project because the
 * corpus has none; then the note, which is the corpus's own annotation naming
 * the point being made ("regular ending -e"). The note was never a translation
 * and is not laid out as one. The English is set in italic so that a glance
 * tells it from the German above it and the note below it without a label.
 *
 * An example with no English shows none. Four of them are English notes the
 * corpus stored in the German field, and restating those would be noise.
 *
 * **What is highlighted, and why it is safe.** The spans come from the build.
 * Most come from the topic's own exercise answers — the corpus pointing at the
 * form it asks you to produce — so in a topic about the perfect tense the
 * participle lights up, and in one about separable verbs the prefix does. Those
 * carry no word class and render in the neutral accent, because an exercise
 * answer says which form is taught and nothing about what kind of word it is.
 *
 * The rest were written by hand for the word-order topics, and those may name
 * a class: a conjunction, a verb, a preposition, a question word. Then the
 * colour says which, and `Wenn der Wecker klingelt, steht Dr. Kauter auf.`
 * shows its connector and the three pieces of its verb bracket as two different
 * things rather than four identical blobs. No parser runs anywhere; an unnamed
 * class stays unnamed.
 *
 * **Colour is never the only channel.** Every highlight is a tinted box and a
 * weight change, so it survives greyscale, and a topic that uses classes prints
 * a legend naming the ones it uses. The legend lists only what is on the page,
 * so it never explains a colour that is not there — and when such a topic also
 * has unnamed marks, it names the neutral tone too. Without that line a learner
 * reading one amber connector and one blue one would take the difference for a
 * distinction, and there is none: the blue only means the class was not written.
 */
export function ExampleList({ examples }: { examples: readonly GrammarExample[] }) {
  const used = legendFor(examples);
  const anyNeutral = examples.some((e) => e.marks.some((m) => !m.role));
  return (
    <View style={styles.stack}>
      {examples.map((example, index) => (
        <View key={index} style={styles.example}>
          <Text style={styles.german} selectable>
            {pieces(example).map((piece, part) => (
              <Text key={part} style={piece.style}>{piece.text}</Text>
            ))}
          </Text>
          {example.en ? <Text style={styles.english} selectable>{example.en}</Text> : null}
          {example.note ? <Text style={styles.note}>{example.note}</Text> : null}
        </View>
      ))}

      {used.length > 0 ? (
        <View style={styles.legend} accessibilityLabel={strings.grammarLegend}>
          {used.map((role) => (
            <View key={role} style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: roleTone[role].ink }]} />
              <Text style={styles.legendText}>{roleTone[role].label}</Text>
            </View>
          ))}
          {anyNeutral ? (
            <View style={styles.legendItem}>
              <View style={[styles.swatch, { backgroundColor: palette.accent }]} />
              <Text style={styles.legendText}>{strings.grammarLegendTaught}</Text>
            </View>
          ) : null}
        </View>
      ) : null}
    </View>
  );
}

/** The classes this topic's examples actually use, in a fixed order. */
const ORDER: readonly MarkRole[] = [
  'conj', 'verb', 'prep', 'article', 'pronoun', 'adjective', 'q',
];

function legendFor(examples: readonly GrammarExample[]): MarkRole[] {
  const seen = new Set<string>();
  for (const example of examples) {
    for (const mark of example.marks) if (mark.role) seen.add(mark.role);
  }
  return ORDER.filter((role) => seen.has(role));
}

/**
 * Cut the sentence at its spans.
 *
 * The spans are ordered and never overlap — the build sorts them and drops the
 * overlaps — so one pass is enough and no character can be emitted twice.
 */
function pieces(example: GrammarExample) {
  const out: { text: string; style?: object }[] = [];
  let at = 0;
  for (const mark of example.marks) {
    if (mark.start > at) out.push({ text: example.text.slice(at, mark.start) });
    out.push({ text: example.text.slice(mark.start, mark.end), style: markStyle(mark) });
    at = mark.end;
  }
  if (at < example.text.length) out.push({ text: example.text.slice(at) });
  return out;
}

function markStyle(mark: GrammarMark) {
  if (!mark.role) return styles.marked;
  const tone = roleTone[mark.role];
  return [styles.marked, { color: tone.ink, backgroundColor: tone.wash }];
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  example: {
    gap: 2,
    paddingLeft: spacing.sm,
    borderLeftWidth: 2,
    borderLeftColor: palette.border,
    paddingVertical: 2,
    borderRadius: radius.sm,
  },
  german: { ...typeScale.body, color: palette.text, lineHeight: 24 },
  english: {
    ...typeScale.caption,
    fontSize: 14,
    fontStyle: 'italic',
    // Darker than the note under it. The English is content — it is what the
    // sentence means — while the note is metadata about the sentence, and a
    // learner should be able to tell which is which without reading either.
    color: palette.textSecond,
    lineHeight: 20,
  },
  note: { ...typeScale.caption, color: palette.textMuted, lineHeight: 19 },
  marked: {
    color: palette.accent,
    fontWeight: '700',
    backgroundColor: palette.accentSoft,
  },
  legend: {
    flexDirection: 'row',
    flexWrap: 'wrap',
    gap: spacing.md,
    paddingTop: spacing.xs,
    borderTopWidth: StyleSheet.hairlineWidth,
    borderTopColor: palette.border,
  },
  legendItem: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: { width: 9, height: 9, borderRadius: 2 },
  legendText: { ...typeScale.caption, color: palette.textMuted },
});
