import { useMemo, useState } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { advise, buildEvidence, type Advice, type CoachEvidence } from '@nemcina/core';
import { useAccount } from '../account';
import { useCourse } from '../course';
import { useProgress } from '../progress';
import { api, syncConfigured, type Quota } from '../api';
import { ApiError } from '../api';
import { strings } from '../strings';
import { palette, spacing, type as typeScale } from '../theme';
import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';

/**
 * What one piece of advice says, in the interface language.
 *
 * The advice itself carries only a kind and the numbers behind it, so this is
 * the only place that turns it into words — and adding a language means adding
 * a table, not touching the reasoning.
 */
function sentence(advice: Advice): string {
  const facts = advice.facts;
  switch (advice.kind) {
    case 'nothing-yet': return strings.adviceNothingYet;
    case 'reviews-due': return strings.adviceReviewsDue(Number(facts.due ?? 0));
    case 'weak-items':
      return strings.adviceWeakItems(Number(facts.weak ?? 0), String(facts.worst ?? ''));
    case 'keep-streak': return strings.adviceKeepStreak(Number(facts.streak ?? 0));
    case 'accuracy-low': return strings.adviceAccuracyLow(Number(facts.accuracy ?? 0));
    case 'accuracy-high': return strings.adviceAccuracyHigh(Number(facts.accuracy ?? 0));
    case 'new-material':
      return strings.adviceNewMaterial(Number(facts.learned ?? 0), Number(facts.remaining ?? 0));
    case 'grammar-untouched': return strings.adviceGrammarUntouched(Number(facts.topics ?? 0));
  }
}

/**
 * The coach.
 *
 * What it says without any model is the real product: sentences derived from
 * the learner's own answers, each one checkable against the numbers beside it.
 * A model, when configured, is asked to phrase the same facts more warmly — it
 * is never the source of them, and its absence costs the panel nothing.
 */
export function CoachPanel() {
  const { repository } = useCourse();
  const { records } = useProgress();
  const { account, token } = useAccount();

  const [text, setText] = useState<string | null>(null);
  const [quota, setQuota] = useState<Quota | null>(null);
  const [busy, setBusy] = useState(false);
  const [error, setError] = useState('');

  const evidence: CoachEvidence = useMemo(
    () => buildEvidence({
      items: repository.vocabulary(),
      topics: repository.grammar(),
      progress: records,
      offsetMinutes: -new Date().getTimezoneOffset(),
    }),
    [repository, records],
  );
  const advice = useMemo(() => advise(evidence).slice(0, 3), [evidence]);

  const canAsk = Boolean(account && token) && syncConfigured();

  const askCoach = async () => {
    if (!token) return;
    setBusy(true);
    setError('');
    try {
      // The token is held by the account context; the request carries evidence
      // and an intent, never a prompt.
      const reply = await api.askCoach(token, 'what-next', evidence);
      setText(reply.text);
      setQuota(reply.quota);
      if (!reply.text) setError(strings.coachNoModel);
    } catch (thrown) {
      setError(thrown instanceof ApiError ? thrown.message : 'Something went wrong.');
    } finally {
      setBusy(false);
    }
  };

  return (
    <Card style={styles.block}>
      <Text style={styles.title}>{strings.coachTitle}</Text>

      {text ? <Text style={styles.spoken}>{text}</Text> : null}

      <Text style={styles.source}>{strings.coachFromYourRecords}</Text>
      {advice.map((entry) => (
        <Text key={entry.kind} style={styles.advice}>• {sentence(entry)}</Text>
      ))}

      {error ? <Text style={styles.error}>{error}</Text> : null}

      {canAsk ? (
        <>
          <PrimaryButton
            label={busy ? strings.coachThinking : strings.coachAsk}
            disabled={busy}
            onPress={() => { void askCoach(); }}
          />
          {quota ? (
            <Text style={styles.source}>
              {strings.coachRemaining(quota.remaining, quota.limit)}
            </Text>
          ) : null}
        </>
      ) : (
        <Text style={styles.source}>
          {syncConfigured() ? strings.coachSignedOut : strings.coachNoModel}
        </Text>
      )}
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  title: { ...typeScale.heading, color: palette.text },
  spoken: { ...typeScale.body, color: palette.text, lineHeight: 23 },
  source: { ...typeScale.caption, color: palette.textMuted },
  advice: { ...typeScale.body, color: palette.text, lineHeight: 22 },
  error: { ...typeScale.caption, color: palette.wrong },
});
