import { StyleSheet, Text, View } from 'react-native';
import { ruleShape } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * The rules of a topic, as separate rules rather than a paragraph each.
 *
 * Before this they were plain lines inside one card, which made a rule look
 * like a sentence of explanation and made the important ones invisible. Each
 * rule now sits on its own with a marker, so the list can be scanned for the
 * one that answers the question rather than read from the top.
 *
 * A rule the corpus opened with "Achtung:" is pulled out into a warning. That
 * is the authors' own emphasis promoted, not emphasis invented here — and the
 * marker word is dropped, because the box already says it.
 */
export function RuleList({ rules }: { rules: readonly string[] }) {
  const shapes = rules.map(ruleShape);
  const warnings = shapes.filter((s) => s.kind === 'warning');
  const plain = shapes.filter((s) => s.kind === 'plain');

  return (
    <View style={styles.stack}>
      {plain.map((rule, index) => (
        <View key={`rule-${index}`} style={styles.rule}>
          <View style={styles.bullet} />
          <Text style={styles.ruleText}>{rule.text}</Text>
        </View>
      ))}

      {warnings.map((rule, index) => (
        <View key={`warn-${index}`} style={styles.warning}>
          {/* The heading is text, not only a colour, so the warning survives
              greyscale and a screen reader. */}
          <Text style={styles.warningLabel}>{strings.grammarWatchOut}</Text>
          <Text style={styles.warningText}>{rule.text}</Text>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  rule: { flexDirection: 'row', gap: spacing.sm, alignItems: 'flex-start' },
  bullet: {
    width: 5, height: 5, borderRadius: 3,
    backgroundColor: palette.accent,
    // Sits on the first line's optical centre rather than its top.
    marginTop: 9,
  },
  ruleText: { ...typeScale.body, color: palette.text, lineHeight: 23, flex: 1 },
  warning: {
    gap: 2,
    backgroundColor: palette.almostSoft,
    borderRadius: radius.sm,
    padding: spacing.sm,
    borderLeftWidth: 3,
    borderLeftColor: palette.almost,
  },
  warningLabel: { ...typeScale.label, color: palette.almost },
  warningText: { ...typeScale.body, color: palette.text, lineHeight: 22 },
});
