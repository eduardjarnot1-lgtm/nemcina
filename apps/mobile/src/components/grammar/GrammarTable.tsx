import { useState } from 'react';
import { ScrollView, StyleSheet, Text, View, type LayoutChangeEvent } from 'react-native';
import type { GrammarTable as Table } from '@nemcina/core';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * A paradigm, as a table.
 *
 * Declensions and endings are a grid, and explaining a grid in sentences is
 * what made these topics hard to use. Four things were wrong with the first
 * version of this, and each of them was a reason a learner could not read it:
 *
 * **The row label scrolled away.** Label and data sat in one scroll view, so
 * reaching the plural column lost "Dativ" — the single piece of context needed
 * to read the cell you had scrolled to. The labels are now outside the scroll
 * view and stay put; only the data moves.
 *
 * **Nothing said more columns existed.** The indicator was switched off and
 * there was no other hint, so on a 360-point screen the table simply looked
 * narrow. The indicator is back, and when the content is wider than the frame a
 * line under the table says so in words — the fade at the edge is a second
 * channel, never the only one.
 *
 * **Every cell looked the same.** Sixteen identical cells, of which three or
 * four are the actual pattern. Emphasised cells are now tinted *and* bold *and*
 * listed in a note beneath, because a learner who cannot see the tint still has
 * to be able to find the pattern.
 *
 * **Reference material was mixed into the lesson.** A2's article table teaches
 * the dative and prints the genitive; the summary said dative and the table
 * said both, which read as a contradiction. Rows can now be set aside: still
 * present, still complete, visibly not the thing being taught today.
 *
 * Every row is exactly as wide as the header — the build refuses to write one
 * that is not — so nothing here has to cope with a ragged grid.
 */
export function GrammarTable({ table }: { table: Table }) {
  const [rowHeader, ...headers] = table.columns;
  const [frame, setFrame] = useState(0);
  const [content, setContent] = useState(0);
  // Only claim there is more to see once both measurements have arrived.
  const scrollable = frame > 0 && content > frame + 1;

  const marked = new Set(table.emphasis.map(([row, column]) => `${row}:${column}`));
  const aside = new Set(table.asideRows);

  return (
    <View style={styles.wrap}>
      {table.caption ? <Text style={styles.caption}>{table.caption}</Text> : null}

      <View style={styles.frame}>
        {/* The labels, held still. */}
        <View style={styles.labels}>
          <View style={[styles.cellBox, styles.headCell, styles.labelCell]}>
            <Text style={styles.headText}>{rowHeader}</Text>
          </View>
          {table.rows.map((row, index) => (
            <View
              key={index}
              style={[
                styles.cellBox,
                styles.labelCell,
                index % 2 === 1 && styles.striped,
                aside.has(index) && styles.asideCell,
              ]}
            >
              <Text style={[styles.rowHead, aside.has(index) && styles.asideText]}>
                {row[0]}
              </Text>
            </View>
          ))}
        </View>

        <View style={styles.scrollArea}>
          <ScrollView
            horizontal
            // Back on. A table that can scroll must look like one.
            showsHorizontalScrollIndicator
            persistentScrollbar
            directionalLockEnabled
            onLayout={(event: LayoutChangeEvent) => setFrame(event.nativeEvent.layout.width)}
            onContentSizeChange={(width) => setContent(width)}
          >
            <View>
              <View style={styles.row}>
                {headers.map((column) => (
                  <View key={column} style={[styles.cellBox, styles.headCell]}>
                    <Text style={styles.headText}>{column}</Text>
                  </View>
                ))}
              </View>
              {table.rows.map((row, index) => (
                <View key={index} style={styles.row}>
                  {row.slice(1).map((cell, column) => {
                    const hot = marked.has(`${index}:${column + 1}`);
                    return (
                      <View
                        key={column}
                        style={[
                          styles.cellBox,
                          index % 2 === 1 && styles.striped,
                          aside.has(index) && styles.asideCell,
                          hot && styles.hotCell,
                        ]}
                      >
                        <Text
                          style={[
                            styles.cell,
                            aside.has(index) && styles.asideText,
                            hot && styles.hotText,
                          ]}
                          selectable
                        >
                          {cell}
                        </Text>
                      </View>
                    );
                  })}
                </View>
              ))}
            </View>
          </ScrollView>
          {/* A soft edge so a half-cut column reads as "continues" rather than
              as the end of the table. The sentence below is what actually
              carries the message. */}
          {scrollable ? <View pointerEvents="none" style={styles.fade} /> : null}
        </View>
      </View>

      {scrollable ? <Text style={styles.hint}>{strings.tableScrollHint}</Text> : null}

      {table.emphasisNote ? (
        <View style={styles.noteRow}>
          <View style={styles.swatch} />
          <Text style={styles.note}>{table.emphasisNote}</Text>
        </View>
      ) : null}

      {table.asideNote ? <Text style={styles.asideNote}>{table.asideNote}</Text> : null}

      {table.key.length > 0 ? (
        <View style={styles.key}>
          <Text style={styles.keyLabel}>{strings.tableKey}</Text>
          {table.key.map((entry) => (
            <Text key={entry.symbol} style={styles.keyLine}>
              <Text style={styles.keySymbol}>{entry.symbol}</Text>
              {`  ${entry.means}`}
            </Text>
          ))}
        </View>
      ) : null}
    </View>
  );
}

const ROW_HEIGHT = 44;

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs },
  caption: { ...typeScale.label, color: palette.text },
  frame: {
    flexDirection: 'row',
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
  labels: {
    borderRightWidth: StyleSheet.hairlineWidth,
    borderRightColor: palette.border,
    backgroundColor: palette.surface,
  },
  scrollArea: { flex: 1 },
  row: { flexDirection: 'row' },
  cellBox: {
    minHeight: ROW_HEIGHT,
    justifyContent: 'center',
    paddingHorizontal: spacing.sm,
    minWidth: 88,
  },
  labelCell: { minWidth: 104 },
  headCell: { backgroundColor: palette.accentSoft, minHeight: 38 },
  striped: { backgroundColor: palette.background },
  cell: { ...typeScale.body, fontSize: 15, color: palette.text },
  rowHead: { ...typeScale.label, color: palette.text },
  headText: { ...typeScale.label, color: palette.accent },
  // The pattern: a tint, a weight, and a line of words under the table.
  hotCell: { backgroundColor: palette.goldSoft },
  hotText: { color: palette.goldInk, fontWeight: '700' },
  // Reference rather than today's lesson.
  asideCell: { backgroundColor: palette.background },
  asideText: { color: palette.textMuted },
  fade: {
    position: 'absolute',
    right: 0, top: 0, bottom: 0, width: 18,
    backgroundColor: palette.surface,
    opacity: 0.55,
  },
  hint: { ...typeScale.caption, color: palette.textMuted },
  noteRow: { flexDirection: 'row', alignItems: 'center', gap: spacing.xs },
  swatch: {
    width: 12, height: 12, borderRadius: 3,
    backgroundColor: palette.goldSoft,
    borderWidth: StyleSheet.hairlineWidth, borderColor: palette.goldInk,
  },
  note: { ...typeScale.caption, color: palette.textSecond, flex: 1 },
  asideNote: { ...typeScale.caption, color: palette.textMuted, fontStyle: 'italic' },
  key: { gap: 2, marginTop: spacing.xs },
  keyLabel: { ...typeScale.label, color: palette.textMuted },
  keyLine: { ...typeScale.caption, color: palette.textSecond },
  keySymbol: { fontWeight: '700', color: palette.text },
});
