import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { MascotPose } from '@nemcina/core';
import { Animated, duration, easing, useReducedMotion } from '../motion';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { strings } from '../strings';

/**
 * Master Fuka, on screen.
 *
 * Four drawings, one per pose. They are `require`d statically rather than
 * built from a template string because the bundler has to see every path at
 * build time — a computed `require` ships nothing and fails at run time.
 */
const POSES: Readonly<Record<MascotPose, ImageSourcePropType>> = {
  greet: require('../../assets/mascot/fuka-greet.webp'),
  think: require('../../assets/mascot/fuka-think.webp'),
  pleased: require('../../assets/mascot/fuka-pleased.webp'),
  celebrate: require('../../assets/mascot/fuka-celebrate.webp'),
};

/**
 * How big he is. Three sizes and no more, so he is the same character at the
 * top of a results screen as beside a line of coach text.
 */
const SIZE = { small: 44, medium: 96, large: 148 } as const;
export type MascotSize = keyof typeof SIZE;

/**
 * The guide, with something to say.
 *
 * **He can fail to load and nothing breaks.** If the drawing does not arrive —
 * a slow connection, a broken asset — the line is still there and still reads,
 * because the text is the part that carries the meaning and the picture is the
 * part that carries the warmth. An app whose results screen is blank because a
 * mascot did not download is an app that made a decoration load-bearing.
 *
 * **Idle is nearly still.** One slow breath, four seconds in and four out, at
 * a scale of 1.012 — under half a pixel at his usual size. It reads as alive
 * rather than as movement, which is the difference between a character and a
 * distraction on a screen someone is trying to read. Under reduced motion he
 * does not breathe at all; he is simply there.
 */
export function Mascot({
  pose, line, size = 'medium', style,
}: {
  pose: MascotPose;
  line?: string;
  size?: MascotSize;
  style?: object;
}) {
  const reduced = useReducedMotion();
  const [failed, setFailed] = useState(false);
  const breath = useRef(new Animated.Value(0)).current;
  const px = SIZE[size];

  useEffect(() => {
    if (reduced) return;
    const cycle = Animated.loop(Animated.sequence([
      Animated.timing(breath, {
        toValue: 1, duration: 4000, easing: easing.standard, useNativeDriver: true,
      }),
      Animated.timing(breath, {
        toValue: 0, duration: 4000, easing: easing.standard, useNativeDriver: true,
      }),
    ]));
    cycle.start();
    // A loop is a timer. It stops when he leaves the screen.
    return () => cycle.stop();
  }, [reduced, breath]);

  const entrance = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  useEffect(() => {
    if (reduced) { entrance.setValue(1); return; }
    entrance.setValue(0);
    const arrive = Animated.timing(entrance, {
      toValue: 1, duration: duration.normal, easing: easing.enter, useNativeDriver: true,
    });
    arrive.start();
    return () => arrive.stop();
  }, [pose, reduced, entrance]);

  const figure = failed ? null : (
    <Animated.View
      style={{
        opacity: entrance,
        transform: [
          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
          { translateY: entrance.interpolate({ inputRange: [0, 1], outputRange: [6, 0] }) },
        ],
      }}
    >
      <Image
        source={POSES[pose]}
        style={{ width: px, height: px }}
        resizeMode="contain"
        onError={() => setFailed(true)}
        // He is decoration beside text that already says it. A screen reader
        // that announced "drawing of a stoat waving" before every result would
        // be reading out the wallpaper.
        accessible={false}
        accessibilityElementsHidden
        importantForAccessibility="no"
      />
    </Animated.View>
  );

  if (!line) return <View style={style}>{figure}</View>;

  return (
    <View style={[styles.row, style]}>
      {figure}
      <View style={styles.bubble}>
        <Text style={styles.name}>{strings.mascotName}</Text>
        <Text style={styles.line}>{line}</Text>
      </View>
    </View>
  );
}

const styles = StyleSheet.create({
  row: { flexDirection: 'row', alignItems: 'center', gap: spacing.sm },
  bubble: {
    flex: 1,
    gap: 2,
    backgroundColor: palette.surface,
    borderRadius: radius.md,
    borderWidth: StyleSheet.hairlineWidth,
    borderColor: palette.border,
    paddingHorizontal: spacing.md,
    paddingVertical: spacing.sm,
  },
  name: { ...typeScale.label, color: palette.textMuted, letterSpacing: 0.4 },
  line: { ...typeScale.body, color: palette.text, lineHeight: 22 },
});
