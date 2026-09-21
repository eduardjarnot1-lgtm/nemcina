import { StyleSheet, Text } from 'react-native';
import { radius, spacing, type as typeScale } from '../../theme';

/**
 * A short label with a tone.
 *
 * Used for the level and the grammatical family. The text is always the whole
 * message — the colour groups, it does not inform — so a chip read aloud or
 * seen in greyscale says exactly the same thing.
 */
export function Chip({ label, ink, wash }: { label: string; ink: string; wash: string }) {
  return (
    <Text style={[styles.chip, { color: ink, backgroundColor: wash }]} numberOfLines={1}>
      {label}
    </Text>
  );
}

const styles = StyleSheet.create({
  chip: {
    ...typeScale.label,
    paddingHorizontal: spacing.sm,
    paddingVertical: 3,
    borderRadius: radius.sm,
    overflow: 'hidden',
  },
});
