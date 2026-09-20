import { useEffect, useRef } from 'react';
import { StyleSheet, View } from 'react-native';
import { palette } from '../theme';
import { Animated, duration, easing, useReducedMotion } from '../motion';

/**
 * Three dots, breathing, while something is genuinely being waited for.
 *
 * It is not a progress bar because there is no progress to report — the coach
 * either answers or it does not. What it does say is "this is still happening",
 * which is the one thing a static screen cannot.
 *
 * It must never be shown to make a fast answer feel considered. If the text is
 * ready, show the text.
 *
 * With reduced motion the dots are simply present and still: the state is
 * carried by the indicator existing at all, not by the movement.
 */
export function Thinking() {
  const reduced = useReducedMotion();
  const dots = [useRef(new Animated.Value(0.35)).current,
                useRef(new Animated.Value(0.35)).current,
                useRef(new Animated.Value(0.35)).current];

  useEffect(() => {
    if (reduced) return;
    const loops = dots.map((dot, index) => Animated.loop(
      Animated.sequence([
        Animated.delay(index * 140),
        Animated.timing(dot, {
          toValue: 1, duration: duration.slow, easing: easing.standard, useNativeDriver: true,
        }),
        Animated.timing(dot, {
          toValue: 0.35, duration: duration.slow, easing: easing.standard, useNativeDriver: true,
        }),
      ]),
    ));
    loops.forEach((loop) => loop.start());
    // Stopped on unmount: a loop left running is a timer the screen no longer
    // owns, and three of them per mount adds up.
    return () => loops.forEach((loop) => loop.stop());
  }, [reduced, dots]);

  return (
    <View style={styles.row} accessibilityRole="progressbar">
      {dots.map((dot, index) => (
        <Animated.View key={index} style={[styles.dot, { opacity: dot }]} />
      ))}
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', gap: 5, alignItems: 'center', paddingVertical: 4 },
  dot: { width: 6, height: 6, borderRadius: 3, backgroundColor: palette.accent },
});
