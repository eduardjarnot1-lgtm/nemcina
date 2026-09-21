import { useState, type ReactNode } from 'react';
import { Pressable, StyleSheet, Text, View } from 'react-native';
import { palette, spacing, type as typeScale } from '../../theme';
import { Animated, useEntrance } from '../../motion';
import { haptic } from '../../haptics';

/**
 * Detail that is real but not needed first.
 *
 * A C1 topic can carry six explanation sections. All six on the first screen is
 * the wall of text this page was; none of them is a page that has lost its
 * content. So the first two stay open and the rest sit behind one control that
 * says how many there are — a count, not a vague "more", because the decision
 * to open it depends on knowing the size.
 *
 * Closed is a real state, not a hidden one: nothing here is the only place a
 * fact appears, and the summary and rules above it always stand alone.
 */
export function Collapsible({
  label, collapsedLabel, children,
}: { label: string; collapsedLabel: string; children: ReactNode }) {
  const [open, setOpen] = useState(false);
  const entrance = useEntrance(open ? 'open' : 'closed');

  return (
    <View style={styles.stack}>
      <Pressable
        accessibilityRole="button"
        accessibilityState={{ expanded: open }}
        onPress={() => { haptic('selection'); setOpen((was) => !was); }}
        style={styles.control}
        hitSlop={8}
      >
        <Text style={styles.label}>{open ? label : collapsedLabel}</Text>
        {/* A caret is decoration; the word beside it is the control. */}
        <Text style={styles.caret}>{open ? '−' : '+'}</Text>
      </Pressable>
      {open ? <Animated.View style={[styles.body, entrance]}>{children}</Animated.View> : null}
    </View>
  );
}

const styles = StyleSheet.create({
  stack: { gap: spacing.sm },
  control: {
    flexDirection: 'row',
    alignItems: 'center',
    justifyContent: 'space-between',
    paddingVertical: spacing.xs,
  },
  label: { ...typeScale.label, color: palette.accent },
  caret: { ...typeScale.label, color: palette.accent, paddingHorizontal: spacing.xs },
  body: { gap: spacing.md },
});
