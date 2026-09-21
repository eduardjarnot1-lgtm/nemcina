import { ScrollView, StyleSheet, Text, View } from 'react-native';
import type { GrammarTable as Table } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';

/**
 * A paradigm, as a table.
 *
 * Declensions and endings are a grid, and explaining a grid in sentences is
 * what made these topics hard to use. The first column is the row label and is
 * held apart from the rest; on a narrow screen the whole table scrolls
 * sideways rather than squeezing four cases into 360 points, because a cell
 * wrapped onto three lines stops being a table.
 *
 * Every row is exactly as wide as the header — the build refuses to write one
 * that is not — so nothing here has to cope with a ragged grid.
 */
export function GrammarTable({ table }: { table: Table }) {
  const [rowHeader, ...headers] = table.columns;

  return (
    <View style={styles.wrap}>
      {table.caption ? <Text style={styles.caption}>{table.caption}</Text> : null}
      <ScrollView
        horizontal
        showsHorizontalScrollIndicator={false}
        contentContainerStyle={styles.grid}
        // A table that scrolls sideways inside a page that scrolls down needs
        // to say which gesture it owns.
        directionalLockEnabled
      >
        <View>
          <View style={[styles.row, styles.headRow]}>
            <Text style={[styles.cell, styles.rowHead, styles.headText]}>{rowHeader}</Text>
            {headers.map((column) => (
              <Text key={column} style={[styles.cell, styles.headText]}>{column}</Text>
            ))}
          </View>
          {table.rows.map((row, index) => {
            const [label, ...cells] = row;
            return (
              <View key={index} style={[styles.row, index % 2 === 1 && styles.striped]}>
                <Text style={[styles.cell, styles.rowHead]}>{label}</Text>
                {cells.map((cell, column) => (
                  <Text key={column} style={styles.cell} selectable>{cell}</Text>
                ))}
              </View>
            );
          })}
        </View>
      </ScrollView>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  caption: { ...typeScale.label, color: palette.textMuted },
  grid: {
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  row: { flexDirection: 'row' },
  headRow: { backgroundColor: palette.accentSoft },
  striped: { backgroundColor: palette.background },
  cell: {
    ...typeScale.caption,
    color: palette.text,
    minWidth: 92,
    paddingHorizontal: spacing.sm,
    paddingVertical: spacing.sm,
  },
  rowHead: { ...typeScale.label, color: palette.text, minWidth: 104 },
  headText: { ...typeScale.label, color: palette.accent },
});
