import { useEffect } from 'react';
import { StyleSheet, Text, View } from 'react-native';
import { Stack, useRouter } from 'expo-router';
import { Screen } from '../src/components/Screen';
import { strings } from '../src/strings';
import { palette, spacing, type as typeScale } from '../src/theme';

/**
 * Any address the app does not recognise.
 *
 * It sends the learner home rather than dead-ending them. That matters for a
 * mistyped or stale link, and it is also what makes the web build survive being
 * served from a subdirectory: the first route is chosen from the URL path, and
 * a path the router has never heard of would otherwise be the whole app.
 */
export default function NotFoundScreen() {
  const router = useRouter();

  useEffect(() => {
    // Replace rather than push: a back button that returns to a dead end is
    // not a back button.
    const handle = setTimeout(() => router.replace('/'), 0);
    return () => clearTimeout(handle);
  }, [router]);

  return (
    <Screen>
      <Stack.Screen options={{ headerShown: false }} />
      <View style={styles.centre}>
        <Text style={styles.note}>{strings.loading}</Text>
      </View>
    </Screen>
  );
}

const styles = StyleSheet.create({
  centre: { flex: 1, alignItems: 'center', justifyContent: 'center' },
  note: { ...typeScale.caption, color: palette.textMuted },
});
