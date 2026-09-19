import { useState } from 'react';
import { ActivityIndicator, StyleSheet, Text, TextInput, View } from 'react-native';
import { useAccount } from '../account';
import { ApiError } from '../api';
import { readableAuthError } from '../firebaseAuth';
import { strings } from '../strings';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { Card } from './Card';
import { PrimaryButton } from './PrimaryButton';

/**
 * Signing in, and syncing.
 *
 * Deliberately not a wall in front of the app. Everything works signed out and
 * stays on the device; an account buys cross-device progress and nothing else,
 * and the panel says so rather than implying the app needs one.
 */
export function AccountPanel() {
  const { account, ready, configured, bookmark, register, signIn, signOut, sync } = useAccount();
  const [mode, setMode] = useState<'signIn' | 'register'>('signIn');
  const [email, setEmail] = useState('');
  const [password, setPassword] = useState('');
  const [busy, setBusy] = useState(false);
  const [message, setMessage] = useState('');
  const [error, setError] = useState('');

  if (!configured) {
    return (
      <Card style={styles.block}>
        <Text style={styles.title}>{strings.accountTitle}</Text>
        <Text style={styles.note}>{strings.accountNotConfigured}</Text>
      </Card>
    );
  }

  if (!ready) {
    return (
      <Card style={styles.block}>
        <ActivityIndicator color={palette.accent} />
      </Card>
    );
  }

  const run = async (work: () => Promise<unknown>) => {
    setBusy(true);
    setError('');
    setMessage('');
    try {
      await work();
    } catch (thrown) {
      // The server writes messages a person can read, so those pass through.
      // Firebase emits codes, which are translated. "Something went wrong" is
      // the last resort, not the default — it tells nobody what to do next.
      setError(thrown instanceof ApiError ? thrown.message : readableAuthError(thrown));
    } finally {
      setBusy(false);
    }
  };

  if (account) {
    return (
      <Card style={styles.block}>
        <Text style={styles.title}>{strings.accountTitle}</Text>
        <Text style={styles.note}>{strings.accountSignedInAs} {account.email}</Text>
        <Text style={styles.note}>
          {account.tier === 'premium' ? strings.accountPremium : strings.accountFree}
          {' · '}
          {bookmark.serverSyncedAt === 0
            ? strings.accountNeverSynced
            : new Date(bookmark.serverSyncedAt).toLocaleString()}
        </Text>
        {message ? <Text style={styles.good}>{message}</Text> : null}
        {error ? <Text style={styles.bad}>{error}</Text> : null}
        <PrimaryButton
          label={busy ? strings.accountSyncing : strings.accountSyncNow}
          disabled={busy}
          onPress={() => void run(async () => {
            const outcome = await sync();
            setMessage(strings.accountSyncResult(outcome.pushed, outcome.pulled));
          })}
        />
        <PrimaryButton
          label={strings.accountSignOut}
          tone="quiet"
          disabled={busy}
          onPress={() => void run(signOut)}
        />
      </Card>
    );
  }

  const submit = () => void run(async () => {
    if (mode === 'register') await register(email.trim(), password);
    else await signIn(email.trim(), password);
    setPassword('');
  });

  return (
    <Card style={styles.block}>
      <Text style={styles.title}>{strings.accountTitle}</Text>
      <Text style={styles.note}>{strings.accountWhySignIn}</Text>

      <TextInput
        style={styles.input}
        value={email}
        onChangeText={setEmail}
        placeholder={strings.accountEmail}
        placeholderTextColor={palette.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        keyboardType="email-address"
        textContentType="emailAddress"
      />
      <TextInput
        style={styles.input}
        value={password}
        onChangeText={setPassword}
        placeholder={strings.accountPassword}
        placeholderTextColor={palette.textMuted}
        autoCapitalize="none"
        autoCorrect={false}
        secureTextEntry
        textContentType={mode === 'register' ? 'newPassword' : 'password'}
        onSubmitEditing={submit}
      />
      {error ? <Text style={styles.bad}>{error}</Text> : null}

      <PrimaryButton
        label={mode === 'register' ? strings.accountRegister : strings.accountSignIn}
        disabled={busy || !email.trim() || !password}
        onPress={submit}
      />
      <PrimaryButton
        label={mode === 'register' ? strings.accountSwitchToSignIn : strings.accountSwitchToRegister}
        tone="quiet"
        disabled={busy}
        onPress={() => { setMode(mode === 'register' ? 'signIn' : 'register'); setError(''); }}
      />
    </Card>
  );
}

const styles = StyleSheet.create({
  block: { gap: spacing.sm },
  title: { ...typeScale.heading, color: palette.text },
  note: { ...typeScale.caption, color: palette.textMuted },
  good: { ...typeScale.caption, color: palette.correct },
  bad: { ...typeScale.caption, color: palette.wrong },
  input: {
    backgroundColor: palette.background,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    padding: spacing.md,
    fontSize: 16,
    color: palette.text,
  },
});
