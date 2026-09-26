import { useState } from 'react';
import { Pressable, ScrollView, StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { Card } from '../src/components/Card';
import { Mascot } from '../src/components/Mascot';
import { mascotLine } from '@nemcina/core';
import { Selectable } from '../src/components/Selectable';
import { PrimaryButton } from '../src/components/PrimaryButton';
import { GOAL_CHOICES, usePreferences } from '../src/preferences';
import { strings } from '../src/strings';
import { palette, radius, spacing, type as typeScale } from '../src/theme';

const GOAL_LABELS: Record<number, string> = {
  8: strings.goalShort,
  12: strings.goalNormal,
  20: strings.goalLong,
};

/**
 * The first thing a new learner sees.
 *
 * Two questions, both of which change what the app does: how long a session
 * should be, and where to start. Nothing is asked that the app would then
 * ignore — an onboarding flow that collects a preference it never uses is a
 * form, not a welcome.
 */
export default function OnboardingScreen() {
  const router = useRouter();
  const { preferences, update } = usePreferences();
  const [goal, setGoal] = useState<number>(preferences.dailyGoal);
  // Chosen once, on mount: a line that re-rolled on every keystroke would read
  // as a character who cannot hold a thought.
  const [greeting] = useState(() => mascotLine('welcome'));

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{strings.welcomeTitle}</Text>
        <Text style={styles.lead}>{strings.welcomeLead}</Text>

        {/* The only screen where he introduces himself. Everywhere else he
            turns up because something happened. */}
        <Mascot {...greeting} line={greeting.text} size="medium" style={styles.mascot} />

        <Card style={styles.block}>
          <Text style={styles.heading}>{strings.welcomeGoalTitle}</Text>
          <View style={styles.choices}>
            {GOAL_CHOICES.map((choice) => (
              <Selectable
                key={choice}
                selected={choice === goal}
                onPress={() => setGoal(choice)}
                style={[styles.choice, choice === goal && styles.choiceActive]}
              >
                <Text style={[styles.choiceValue, choice === goal && styles.choiceActiveText]}>
                  {strings.goalWords(choice)}
                </Text>
                <Text style={[styles.choiceLabel, choice === goal && styles.choiceActiveText]}>
                  {GOAL_LABELS[choice]}
                </Text>
              </Selectable>
            ))}
          </View>
          <Text style={styles.note}>{strings.welcomeGoalNote}</Text>
        </Card>

        <Card style={styles.block}>
          <Text style={styles.heading}>{strings.welcomeLevelTitle}</Text>
          <Text style={styles.note}>{strings.welcomeLevelNote}</Text>
          <PrimaryButton
            label={strings.welcomeTakeTest}
            onPress={() => {
              void update({ dailyGoal: goal });
              router.push('/placement');
            }}
          />
          <PrimaryButton
            label={strings.welcomeSkipTest}
            tone="quiet"
            onPress={() => {
              // Skipping is a real answer, not a deferral: start at A1 and say so.
              void update({ dailyGoal: goal, startingLevel: 'A1', onboarded: true });
              router.replace('/');
            }}
          />
        </Card>
      </ScrollView>
    </Screen>
  );
}

const styles = StyleSheet.create({
  mascot: { marginBottom: spacing.xs },
  content: { paddingVertical: spacing.xl, gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...typeScale.display, color: palette.text },
  lead: { ...typeScale.body, color: palette.textMuted, lineHeight: 23 },
  block: { gap: spacing.sm },
  heading: { ...typeScale.heading, color: palette.text },
  note: { ...typeScale.caption, color: palette.textMuted },
  choices: { flexDirection: 'row', gap: spacing.sm },
  choice: {
    flex: 1,
    alignItems: 'center',
    paddingVertical: spacing.md,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    backgroundColor: palette.background,
  },
  choiceActive: { backgroundColor: palette.accent, borderColor: palette.accent },
  choiceValue: { ...typeScale.heading, color: palette.text },
  choiceLabel: { ...typeScale.caption, color: palette.textMuted, textAlign: 'center' },
  choiceActiveText: { color: '#ffffff' },
});
