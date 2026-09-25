import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CourseProvider } from '../src/course';
import { ProgressProvider } from '../src/progress';
import { AccountProvider } from '../src/account';
import { PreferencesProvider } from '../src/preferences';
import { palette } from '../src/theme';
import { useReducedMotion } from '../src/motion';

export default function RootLayout() {
  // One transition for every push in the app, rather than a different one per
  // screen. React Navigation's default on the web is no transition at all, so
  // a lesson replaced the list it came from between two frames and nothing said
  // which direction the learner had gone.
  //
  // `useReducedMotion` is read here rather than inside each screen because a
  // navigator animation is not something a screen can opt out of: with the
  // setting on, the push is instant and the screen simply is where it was
  // going.
  const reduced = useReducedMotion();
  return (
    <SafeAreaProvider>
      <PreferencesProvider>
        <CourseProvider>
          <ProgressProvider>
          <AccountProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
                animation: reduced ? 'none' : 'slide_from_right',
                headerShadowVisible: false,
                headerStyle: { backgroundColor: palette.background },
                contentStyle: { backgroundColor: palette.background },
              }}
            >
              <Stack.Screen name="(tabs)" options={{ headerShown: false }} />
              <Stack.Screen
                name="session/[lessonId]"
                options={{ title: '', presentation: 'card' }}
              />
            </Stack>
          </AccountProvider>
          </ProgressProvider>
        </CourseProvider>
      </PreferencesProvider>
    </SafeAreaProvider>
  );
}
