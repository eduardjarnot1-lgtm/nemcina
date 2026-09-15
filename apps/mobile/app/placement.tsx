import { useEffect, useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { PlacementTest, type PlacementResult } from '@nemcina/core';
import { Screen } from '../src/components/Screen';
import { Card } from '../src/components/Card';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { ProgressBar } from '../src/components/ProgressBar';
import { useCourse } from '../src/course';
import { usePreferences } from '../src/preferences';
import { strings } from '../src/strings';
import { palette, radius, spacing, type as typeScale } from '../src/theme';

const EXPLANATION: Record<PlacementResult['confidence'], string> = {
  bracketed: strings.placementResultBracketed,
  partial: strings.placementResultPartial,
  exhausted: strings.placementResultExhausted,
};

/**
 * The placement test.
 *
 * Recognition only, four options, and an explicit "I don't know" — because
 * without one people guess, and a guessed right answer places them above where
 * they can actually work.
 */
export default function PlacementScreen() {
  const router = useRouter();
  const { repository } = useCourse();
  const { update } = usePreferences();
  const [placement, setPlacement] = useState<PlacementTest | null>(null);
  const [, bump] = useState(0);

  useEffect(() => {
    if (placement) return;
    setPlacement(PlacementTest.create(repository.vocabulary()));
  }, [placement, repository]);

  if (!placement) {
    return <Screen><Text style={styles.note}>{strings.loading}</Text></Screen>;
  }

  const result = placement.result;
  if (result) {
    return (
      <Screen>
        <Stack.Screen options={{ headerShown: false }} />
        <View style={styles.centre}>
          <Text style={styles.note}>{strings.placementResultTitle}</Text>
          <Text style={styles.level}>{result.level}</Text>
          <Text style={styles.note}>
            {result.asked > 0
              ? `${strings.placementScore(result.correct, result.asked)} · ${EXPLANATION[result.confidence]}`
              : strings.placementNoContent}
          </Text>
          <PrimaryButton
            label={strings.placementBegin}
            onPress={() => {
              void update({ startingLevel: result.level, onboarded: true });
              router.replace('/');
            }}
          />
        </View>
      </Screen>
    );
  }

  const question = placement.current;
  const position = placement.position;

  const answer = (given: string) => {
    placement.answer(given);
    bump((n) => n + 1);
  };

  return (
    <Screen>
      <Stack.Screen options={{ title: strings.placementTitle }} />
      <ProgressBar value={position.max === 0 ? 0 : position.index / position.max} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.note}>{strings.placementProgress(position.index + 1, position.max)}</Text>
        <Text style={styles.subject}>{question?.subject}</Text>
        <View style={styles.options}>
          {question?.options.map((option) => (
            <Pressable
              key={option}
              accessibilityRole="button"
              onPress={() => answer(option)}
              style={({ pressed }) => [styles.option, pressed && styles.optionPressed]}
            >
              <Text style={styles.optionLabel}>{option}</Text>
            </Pressable>
          ))}
        </View>
        <PrimaryButton
          label={strings.placementDontKnow}
          tone="quiet"
          // An explicit wrong answer, not a skip: not knowing is information.
          onPress={() => answer('')}
        />
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.lg, gap: spacing.md },
  centre: { flex: 1, justifyContent: 'center', gap: spacing.md, alignItems: 'flex-start' },
  note: { ...typeScale.caption, color: palette.textMuted },
  level: { ...typeScale.display, fontSize: 56, color: palette.accent },
  subject: { ...typeScale.display, color: palette.text },
  options: { gap: spacing.sm },
  option: {
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
  },
  optionPressed: { backgroundColor: palette.accentSoft },
  optionLabel: { ...typeScale.body, color: palette.text },
});
