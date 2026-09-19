import type { ReactNode } from 'react';
import { StyleSheet, View } from 'react-native';
import { useSafeAreaInsets } from 'react-native-safe-area-context';
import { palette, spacing } from '../theme';

/**
 * The page frame.
 *
 * Every screen sits inside the safe area, because a phone with a notch will
 * otherwise put the first line of a question underneath the camera.
 */
export function Screen({ children, padded = true }: { children: ReactNode; padded?: boolean }) {
  const insets = useSafeAreaInsets();
  return (
    <View
      style={[
        styles.screen,
        { paddingTop: insets.top, paddingBottom: insets.bottom },
        padded && styles.padded,
      ]}
    >
      {children}
    </View>
  );
}

const styles = StyleSheet.create({
  screen: { flex: 1, backgroundColor: palette.background },
  padded: { paddingHorizontal: spacing.md },
});
