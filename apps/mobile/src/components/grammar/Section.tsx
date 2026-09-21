import { StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typeScale } from '../../theme';

/**
 * One headed passage of explanation, with the topic's family colour on its edge.
 *
 * The rail is the only thing carrying the colour: it groups the page without
 * tinting the text, which has to stay at full reading contrast. A section with
 * no heading is just its text — the corpus has a few, and inventing a heading
 * to fill the slot would be writing grammar.
 */
export function Section({
  heading, text, ink,
}: { heading: string; text: string; ink: string }) {
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
});
