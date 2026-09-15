import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { streak, totals } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AccountPanel } from '../../src/components/AccountPanel';
import { useProgress } from '../../src/progress';
import { strings } from '../../src/strings';
import { palette, spacing, type as typeScale } from '../../src/theme';

export default function ProfileScreen() {
  const { records, clear } = useProgress();
  const [confirming, setConfirming] = useState(false);

  const summary = useMemo(() => totals(records.values()), [records]);
  // The streak is derived from review times rather than a stored counter, so it
  // cannot drift out of step with what the learner actually did.
  const days = useMemo(
    () => streak(
      [...records.values()].filter((r) => r.seen).map((r) => ({ at: r.lastReviewed })),
      { offsetMinutes: -new Date().getTimezoneOffset() },
    ),
    [records],
  );

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{strings.tabProfile}</Text>

        <Card style={styles.block}>
          <Text style={styles.blockTitle}>{strings.profileProgress}</Text>
          <Row label={strings.wordsLearned} value={summary.learned} />
          <Row label={strings.wordsMastered} value={summary.mastered} />
          <Row label={strings.dueToday} value={summary.due} />
          <Row label={strings.streak} value={days.current} />
        </Card>

        <AccountPanel />

        <Card style={styles.block}>
          <Text style={styles.blockTitle}>{strings.profileSources}</Text>
          <Text style={styles.note}>{strings.profileSourcesExplain}</Text>
        </Card>

        <Card style={styles.block}>
          <Text style={styles.blockTitle}>{strings.profileReset}</Text>
          <Text style={styles.note}>{strings.profileResetExplain}</Text>
          {confirming ? (
            <View style={styles.confirmRow}>
              <View style={styles.confirmButton}>
                <PrimaryButton
                  label={strings.profileResetConfirm}
                  onPress={() => { void clear(); setConfirming(false); }}
                />
              </View>
              <View style={styles.confirmButton}>
                <PrimaryButton
                  label={strings.profileResetCancel}
                  tone="quiet"
                  onPress={() => setConfirming(false)}
                />
              </View>
            </View>
          ) : (
            <PrimaryButton
              label={strings.profileReset}
              tone="quiet"
              onPress={() => setConfirming(true)}
            />
          )}
        </Card>
      </ScrollView>
    </Screen>
  );
}

function Row({ label, value }: { label: string; value: number }) {
  return (
    <View style={styles.row}>
      <Text style={styles.rowLabel}>{label}</Text>
      <Text style={styles.rowValue}>{value}</Text>
    </View>
  );
}

const styles = StyleSheet.create({
  content: { paddingVertical: spacing.md, gap: spacing.md, paddingBottom: spacing.xl },
  title: { ...typeScale.display, color: palette.text },
  block: { gap: spacing.sm },
  blockTitle: { ...typeScale.heading, color: palette.text },
  note: { ...typeScale.caption, color: palette.textMuted },
  row: { flexDirection: 'row', justifyContent: 'space-between' },
  rowLabel: { ...typeScale.body, color: palette.textMuted },
  rowValue: { ...typeScale.body, color: palette.text, fontWeight: '600' },
  confirmRow: { flexDirection: 'row', gap: spacing.sm },
  confirmButton: { flex: 1 },
});
