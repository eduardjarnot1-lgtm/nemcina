import { StyleSheet, Text, View } from 'react-native';
import { isExceptionHeading } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * One headed passage of explanation, with the topic's family colour on its edge.
 *
 * The rail is the only thing carrying the colour: it groups the page without
 * tinting the text, which has to stay at full reading contrast. A section with
 * no heading is just its text — the corpus has a few, and inventing a heading
 * to fill the slot would be writing grammar.
 *
 * A section whose own heading calls it an exception is boxed instead. Five in
 * the corpus do — "The one exception", "The commonest mistake" — and a
 * paragraph that says that about itself should not look like the four around
 * it. The label above it is a word, so the box does not rely on its tint.
 */
export function Section({
  heading, text, ink,
}: { heading: string; text: string; ink: string }) {
  if (isExceptionHeading(heading)) {
    return (
      <View style={styles.exception}>
        <Text style={styles.exceptionLabel}>{strings.grammarException}</Text>
        <Text style={styles.exceptionHeading}>{heading}</Text>
        <Text style={styles.body}>{text}</Text>
      </View>
    );
  }

  return (
    <View style={[styles.section, { borderLeftColor: ink }]}>
      {heading ? <Text style={styles.heading}>{heading}</Text> : null}
      <Text style={styles.body}>{text}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  section: { gap: spacing.xs, paddingLeft: spacing.md, borderLeftWidth: 3 },
  heading: { ...typeScale.heading, color: palette.text },
  body: { ...typeScale.body, color: palette.text, lineHeight: 24 },
  exception: {
    gap: spacing.xs,
    backgroundColor: palette.almostSoft,
    borderRadius: radius.sm,
    padding: spacing.md,
    borderLeftWidth: 3,
    borderLeftColor: palette.almost,
  },
  exceptionLabel: { ...typeScale.label, color: palette.almost },
  exceptionHeading: { ...typeScale.heading, color: palette.text },
});
