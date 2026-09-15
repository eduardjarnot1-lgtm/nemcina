import { Pressable, StyleSheet, Text, View } from 'react-native';
import { useRouter } from 'expo-router';
import { CEFR_LEVELS, type CefrLevel } from '@nemcina/core';
import { GOAL_CHOICES, usePreferences } from '../preferences';
import { strings } from '../strings';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';

/**
 * The two answers onboarding asked for, changeable afterwards.
 *
 * A setting that can only be chosen once is a trap: someone who guessed their
 * level in the first thirty seconds should be able to move it without
 * reinstalling the app.
 */
export function LearningPanel() {
  const router = useRouter();
  const { preferences, update } = usePreferences();

  return (
    <Card style={styles.block}>
      <Text style={styles.title}>{strings.dailyGoal}</Text>
      <View style={styles.row}>
        {GOAL_CHOICES.map((choice) => (
          <Chip
            key={choice}
            label={strings.goalWords(choice)}
            active={choice === preferences.dailyGoal}
            onPress={() => void update({ dailyGoal: choice })}
          />
        ))}
      </View>

      <Text style={styles.title}>{strings.startingLevel}</Text>
      <View style={styles.row}>
        {CEFR_LEVELS.filter((level) => level !== 'C1' && level !== 'C2').map((level) => (
          <Chip
            key={level}
            label={level}
            active={level === preferences.startingLevel}
            onPress={() => void update({ startingLevel: level as CefrLevel })}
          />
        ))}
      </View>

      <PrimaryButton
        label={strings.placementRetake}
        tone="quiet"
        onPress={() => router.push('/placement')}
      />
    </Card>
  );
}

function Chip({ label, active, onPress }: { label: string; active: boolean; onPress: () => void }) {
  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected: active }}
      onPress={onPress}
      style={[styles.chip, active && styles.chipActive]}
    >
      <Text style={[styles.chipLabel, active && styles.chipLabelActive]}>{label}</Text>
    </Pressable>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  title: { ...typeScale.heading, color: palette.text },
  row: { flexDirection: 'row', gap: spacing.sm, flexWrap: 'wrap' },
  chip: {
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
    borderRadius: radius.lg,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.background,
  },
  chipActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  chipLabel: { ...typeScale.label, color: palette.textMuted },
  chipLabelActive: { color: '#ffffff' },
});
