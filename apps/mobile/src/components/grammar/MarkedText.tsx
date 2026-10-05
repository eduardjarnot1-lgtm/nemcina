import { StyleSheet, Text, type StyleProp, type TextStyle } from 'react-native';
import type { GrammarMark } from '@nemcina/core';
import { roleTone } from '../../grammarTheme';
import { palette } from '../../theme';

/**
 * A sentence with its marks drawn.
 *
 * Lifted out of `ExampleList` so a worked example, a table cell and a source
 * example all highlight by one rule. Two places deciding independently what a
 * `support` mark looks like is how the same class ends up meaning two things on
 * one page.
 *
 * No isolate-on-tap here: that belongs to the source examples, where the point
 * is finding a pattern inside a sentence you are reading. A worked example is
 * already reduced to its point.
 */
export function MarkedText({
  text, marks, style,
}: {
  text: string;
  marks: readonly GrammarMark[];
  style?: StyleProp<TextStyle>;
}) {
  const out: { text: string; style?: StyleProp<TextStyle> }[] = [];
  let at = 0;
  for (const mark of marks) {
    if (mark.start > at) out.push({ text: text.slice(at, mark.start) });
    out.push({ text: text.slice(mark.start, mark.end), style: markStyle(mark) });
    at = mark.end;
  }
  if (at < text.length) out.push({ text: text.slice(at) });

  return (
    <Text style={style} selectable>
      {out.map((piece, index) => (
        piece.style
          ? <Text key={index} style={piece.style}>{piece.text}</Text>
          : <Text key={index}>{piece.text}</Text>
      ))}
    </Text>
  );
}

function markStyle(mark: GrammarMark): StyleProp<TextStyle> {
  const support = mark.tier === 'support';
  if (!mark.role) {
    return support
      ? [styles.marked, styles.support, { color: palette.accent, borderBottomColor: palette.accent }]
      : styles.marked;
  }
  const tone = roleTone[mark.role];
  return support
    ? [styles.marked, styles.support, { color: tone.ink, borderBottomColor: tone.ink }]
    : [styles.marked, { color: tone.ink, backgroundColor: tone.wash }];
}

const styles = StyleSheet.create({
  marked: { color: palette.accent, fontWeight: '700', backgroundColor: palette.accentSoft },
  support: {
    backgroundColor: 'transparent',
    fontWeight: '600',
    borderBottomWidth: 1.5,
    borderStyle: 'dotted',
  },
});
