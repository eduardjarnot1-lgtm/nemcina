import { StyleSheet, Text, View } from 'react-native';
import { palette, radius, spacing, type as typeScale } from '../../theme';

/**
 * The examples of a topic.
 *
 * The German sits on its own line at reading size; its annotation sits under it,
 * smaller and quieter. Before this the two were the same weight, so a page of
 * examples read as a page of prose and the sentences did not stand out from the
 * comments about them.
 *
 * These annotations are **not translations** and are not presented as such. The
 * corpus has no English for grammar examples — only a short note naming the
 * point, "regular ending -e" or "du-form; the stem ends in -t". Laying one out
 * as if it were a translation would be a claim the data does not make.
 */
export function ExampleList({
  examples,
}: {
  examples: readonly { readonly text: string; readonly note: string }[];
}) {
  return (
    <View style={styles.stack}>
      {examples.map((example, index) => (
        <View key={index} style={styles.example}>
          <Text style={styles.german} selectable>{example.text}</Text>
          {example.note ? <Text style={styles.note}>{example.note}</Text> : null}
        </View>
      ))}
    </View>
  );
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
  german: { ...typeScale.body, color: palette.text, lineHeight: 23 },
  note: { ...typeScale.caption, color: palette.textMuted, lineHeight: 19 },
});
