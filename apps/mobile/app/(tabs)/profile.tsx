import { useMemo, useState } from 'react';
import { ScrollView, StyleSheet, Text, View } from 'react-native';
import { totals } from '@nemcina/core';
import { Screen } from '../../src/components/Screen';
import { Card } from '../../src/components/Card';
import { PrimaryButton } from '../../src/components/PrimaryButton';
import { AccountPanel } from '../../src/components/AccountPanel';
import { LearningPanel } from '../../src/components/LearningPanel';
import { LevelPanel } from '../../src/components/LevelPanel';
import { useProgress } from '../../src/progress';
import { useStudySummary } from '../../src/studySummary';
import { strings } from '../../src/strings';
import { palette, spacing, type as typeScale } from '../../src/theme';

export default function ProfileScreen() {
  const { records, clear } = useProgress();
  const [confirming, setConfirming] = useState(false);
  const [clearing, setClearing] = useState(false);
  const [clearError, setClearError] = useState(false);
  const resetProgress = async () => {
    if (clearing) return;
    setClearing(true);
    setClearError(false);
    try { await clear(); setConfirming(false); }
    catch { setClearError(true); }
    finally { setClearing(false); }
  };

  const summary = useMemo(() => totals(records.values()), [records]);
  const activity = useStudySummary();

  return (
    <Screen>
      <ScrollView contentContainerStyle={styles.content} showsVerticalScrollIndicator={false}>
        <Text style={styles.title}>{strings.tabProfile}</Text>

        <Card style={styles.block}>
          <Text style={styles.blockTitle}>{strings.profileProgress}</Text>
          <Row label={strings.wordsLearned} value={summary.learned} />
          <Row label={strings.wordsMastered} value={summary.mastered} />
          <Row label={strings.dueToday} value={summary.due} />
          <Row label={strings.streak} value={activity.streak.current} />
        </Card>

        <LevelPanel />

        <LearningPanel />

        <AccountPanel />

        <Card style={styles.block}>
          <Text style={styles.blockTitle}>{strings.profileSources}</Text>
          <Text style={styles.note}>{strings.profileSourcesExplain}</Text>
        </Card>

        <Card style={styles.block}>
          <Text style={styles.blockTitle}>{strings.profileReset}</Text>
          <Text style={styles.note}>{strings.profileResetExplain}</Text>
          {clearError ? <Text accessibilityRole="alert" style={styles.note}>{strings.resetFailed}</Text> : null}
          {confirming ? (
            <View style={styles.confirmRow}>
              <View style={styles.confirmButton}>
                <PrimaryButton
                  label={strings.profileResetConfirm}
                  disabled={clearing}
                  onPress={() => { void resetProgress(); }}
                />
              </View>
              <View style={styles.confirmButton}>
                <PrimaryButton
                  label={strings.profileResetCancel}
                  tone="quiet"
                  disabled={clearing}
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
