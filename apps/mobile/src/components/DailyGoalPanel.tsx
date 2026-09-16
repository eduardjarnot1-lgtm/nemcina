import { StyleSheet, Text, View } from 'react-native';
import { DAY_MS } from '@nemcina/core';
import { useStudySummary } from '../studySummary';
import { usePreferences } from '../preferences';
import { strings } from '../strings';
import { palette, spacing, type as typeScale } from '../theme';
import { Card } from './Card';
import { ProgressBar } from './ProgressBar';

export function DailyGoalPanel() {
  const activity = useStudySummary();
  const { preferences } = usePreferences();
  const goal = preferences.dailyGoal;
  const completed = activity.today >= goal;
  return (
    <Card style={styles.block}>
      <View style={styles.heading}>
        <Text style={styles.title}>{strings.dailyGoalTitle}</Text>
        <Text style={styles.meta}>{strings.streakDays(activity.streak.current)}</Text>
      </View>
      <Text style={styles.count}>{strings.dailyGoalCount(activity.today, goal)}</Text>
      <ProgressBar value={Math.min(1, activity.today / goal)} />
      <Text accessibilityLiveRegion="polite" style={styles.meta}>
        {completed ? strings.dailyGoalDone : strings.dailyGoalRemaining(goal - activity.today)}
      </Text>
      <Text style={styles.weekTitle}>{strings.weeklyActivity}</Text>
      <View style={styles.week}>
        {activity.week.map(({ day, count }) => {
          const date = new Date(day * DAY_MS);
          const label = date.toLocaleDateString('en', { weekday: 'short', timeZone: 'UTC' });
          const fullDate = date.toLocaleDateString('en', { month: 'long', day: 'numeric', timeZone: 'UTC' });
          return (
            <View key={day} style={styles.day} accessible
              accessibilityLabel={`${fullDate}: ${count} answers`}>
              <Text style={styles.dayLabel}>{label}</Text>
              <Text style={[styles.dayCount, count > 0 && styles.activeDay]}>{count}</Text>
            </View>
          );
        })}
      </View>
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  heading: { flexDirection: 'row', flexWrap: 'wrap', justifyContent: 'space-between', gap: spacing.xs },
  title: { ...typeScale.heading, color: palette.text },
  count: { ...typeScale.title, color: palette.text },
  meta: { ...typeScale.caption, color: palette.textMuted },
  weekTitle: { ...typeScale.caption, color: palette.textMuted, marginTop: spacing.sm },
  week: { flexDirection: 'row', justifyContent: 'space-between', gap: spacing.xs },
  day: { flex: 1, alignItems: 'center', gap: spacing.xs },
  dayLabel: { ...typeScale.caption, color: palette.textMuted },
  dayCount: { ...typeScale.body, color: palette.textMuted },
  activeDay: { color: palette.correct, fontWeight: '700' },
});
