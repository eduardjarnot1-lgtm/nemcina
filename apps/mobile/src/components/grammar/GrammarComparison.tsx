import { StyleSheet, Text, View } from 'react-native';
import type { GrammarComparison as Comparison } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';

/**
 * Two structures learners confuse, side by side.
 *
 * Two columns rather than a wide scrolling table, because the comparison is
 * the point and a comparison you have to scroll sideways to finish is not one.
 * Each row names what is being compared on its own line above the pair, so at
 * phone width the aspect is never squeezed into a third column.
 *
 * The two sides are tinted differently and also **headed by name**, so which
 * is which does not depend on telling the tints apart.
 */
export function GrammarComparison({ comparison }: { comparison: Comparison }) {
  return (
    <View style={styles.wrap}>
      <View style={styles.headRow}>
        <Text style={[styles.head, styles.left]}>{comparison.left}</Text>
        <Text style={[styles.head, styles.right]}>{comparison.right}</Text>
      </View>

      {comparison.rows.map((row, index) => (
        <View key={index} style={styles.row}>
          <Text style={styles.aspect}>{row.aspect}</Text>
          <View style={styles.pair}>
            <Text style={[styles.cell, styles.leftCell]} selectable>{row.left}</Text>
            <Text style={[styles.cell, styles.rightCell]} selectable>{row.right}</Text>
          </View>
        </View>
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.sm },
  headRow: { flexDirection: 'row', gap: spacing.sm },
  head: {
    ...typeScale.label,
    flex: 1,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  left: { color: palette.accent, backgroundColor: palette.accentSoft },
  right: { color: '#6b3fa0', backgroundColor: '#f1eafa' },
  row: { gap: 2 },
  aspect: { ...typeScale.caption, color: palette.textMuted },
  pair: { flexDirection: 'row', gap: spacing.sm },
  cell: {
    ...typeScale.body,
    flex: 1,
    color: palette.text,
    lineHeight: 22,
    paddingVertical: spacing.xs,
    paddingHorizontal: spacing.sm,
    borderRadius: radius.sm,
    borderLeftWidth: 2,
  },
  leftCell: { borderLeftColor: palette.accent, backgroundColor: palette.background },
  rightCell: { borderLeftColor: '#6b3fa0', backgroundColor: palette.background },
});
