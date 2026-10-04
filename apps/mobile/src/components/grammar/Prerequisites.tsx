import { StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { Selectable } from '../Selectable';
import { useCourse } from '../../course';
import { palette, radius, spacing, type as typeScale } from '../../theme';
import { strings } from '../../strings';

/**
 * What to know first.
 *
 * A hundred of the 136 topics name prerequisite topic ids. The field was
 * parsed, typed and read by nothing — a learner who opened "Adjectives after
 * the definite article" without the case system got no hint that there was
 * something to read first, and no route to it.
 *
 * Ids that no longer resolve are skipped rather than shown as dead chips: a
 * prerequisite is a promise that the thing is there, and a tappable row that
 * goes nowhere is worse than no row.
 */
export function Prerequisites({ ids }: { ids: readonly string[] }) {
  const router = useRouter();
  const { repository } = useCourse();

  const known = ids
    .map((id) => repository.topic(id))
    .filter((topic): topic is NonNullable<typeof topic> => topic !== null);
  if (known.length === 0) return null;

  return (
    <View style={styles.wrap}>
      <Text style={styles.label}>{strings.grammarFirst}</Text>
      <View style={styles.row}>
        {known.map((topic) => (
          <Selectable
            key={topic.id}
            selected={false}
            onPress={() => router.push(`/grammar/${encodeURIComponent(topic.id)}`)}
            style={styles.chip}
          >
            <Text style={styles.chipText} numberOfLines={2}>{topic.title}</Text>
          </Selectable>
        ))}
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  wrap: { gap: spacing.xs, marginTop: spacing.xs },
  label: { ...typeScale.label, color: palette.textMuted, letterSpacing: 0.6 },
  row: { flexDirection: 'row', flexWrap: 'wrap', gap: spacing.xs },
  chip: {
    paddingHorizontal: spacing.sm,
    paddingVertical: 6,
    borderRadius: radius.sm,
    backgroundColor: palette.surface,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    maxWidth: 300,
  },
  chipText: { ...typeScale.caption, color: palette.accent, fontWeight: '600' },
});
