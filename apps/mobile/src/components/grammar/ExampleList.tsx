import { StyleSheet, Text, View } from 'react-native';
import type { GrammarExample } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';

/**
 * The examples of a topic, with the forms it teaches picked out.
 *
 * The German sits on its own line at reading size; its annotation sits under
 * it, smaller and quieter. Before this the two were the same weight, so a page
 * of examples read as a page of prose.
 *
 * **What is highlighted, and why it is safe.** The spans come from the build,
 * which takes them from the topic's own exercise answers — the corpus pointing
 * at the form it asks you to produce. So in a topic about the perfect tense the
 * participle lights up, and in one about separable verbs the prefix does.
 * Nothing here identifies "the verb" or "the subject": that needs a parser, and
 * a wrong guess teaches wrong grammar. An example the build could not mark is
 * simply not highlighted, which is a normal state and not a gap.
 *
 * The highlight is a tinted box behind the word **and** a weight change, so it
 * survives greyscale and does not depend on colour alone.
 *
 * These annotations are **not translations** and are not laid out as such. The
 * corpus has no English for grammar examples — only a note naming the point.
 */
export function ExampleList({ examples }: { examples: readonly GrammarExample[] }) {
  return (
    <View style={styles.stack}>
      {examples.map((example, index) => (
        <View key={index} style={styles.example}>
          <Text style={styles.german} selectable>
            {pieces(example).map((piece, part) => (
              <Text key={part} style={piece.marked ? styles.marked : undefined}>
                {piece.text}
              </Text>
            ))}
          </Text>
          {example.note ? <Text style={styles.note}>{example.note}</Text> : null}
        </View>
      ))}
    </View>
  );
}

/**
 * Cut the sentence at its spans.
 *
 * The spans are ordered and never overlap — the build sorts them and drops the
 * overlaps — so one pass is enough and no character can be emitted twice.
 */
function pieces(example: GrammarExample): { text: string; marked: boolean }[] {
  const out: { text: string; marked: boolean }[] = [];
  let at = 0;
  for (const [start, end] of example.marks) {
    if (start > at) out.push({ text: example.text.slice(at, start), marked: false });
    out.push({ text: example.text.slice(start, end), marked: true });
    at = end;
  }
  if (at < example.text.length) out.push({ text: example.text.slice(at), marked: false });
  return out;
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
  marked: {
    color: palette.accent,
    fontWeight: '700',
    backgroundColor: palette.accentSoft,
  },
  note: { ...typeScale.caption, color: palette.textMuted, lineHeight: 19 },
});
