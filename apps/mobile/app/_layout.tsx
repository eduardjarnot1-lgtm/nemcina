import { Stack } from 'expo-router';
import { StatusBar } from 'expo-status-bar';
import { SafeAreaProvider } from 'react-native-safe-area-context';
import { CourseProvider } from '../src/course';
import { ProgressProvider } from '../src/progress';
import { AccountProvider } from '../src/account';
import { palette } from '../src/theme';

export default function RootLayout() {
  return (
    <SafeAreaProvider>
      <CourseProvider>
        <ProgressProvider>
          <AccountProvider>
            <StatusBar style="dark" />
            <Stack
              screenOptions={{
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
    </SafeAreaProvider>
  );
}
