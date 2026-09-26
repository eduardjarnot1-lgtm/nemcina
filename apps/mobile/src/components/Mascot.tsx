import { useEffect, useRef, useState } from 'react';
import { Image, StyleSheet, Text, View, type ImageSourcePropType } from 'react-native';
import type { MascotPose } from '@nemcina/core';
import { Animated, duration, easing, useReducedMotion } from '../motion';
import { usePreferences } from '../preferences';
import { palette, radius, spacing, type as typeScale } from '../theme';
import { strings } from '../strings';

/**
 * Master Fuka, on screen.
 *
 * Four drawings, `require`d statically because the bundler has to see every
 * path at build time — a computed `require` ships nothing and fails at run
 * time.
 */
const POSES: Readonly<Record<MascotPose, ImageSourcePropType>> = {
  greet: require('../../assets/mascot/fuka-greet.webp'),
  think: require('../../assets/mascot/fuka-think.webp'),
  pleased: require('../../assets/mascot/fuka-pleased.webp'),
  celebrate: require('../../assets/mascot/fuka-celebrate.webp'),
};

/**
 * Four sizes and no more, so he is the same character everywhere.
 *
 * `hero` is the home screen and a finished session — the two places where he
 * is the thing you look at rather than something beside what you are reading.
 */
const SIZE = { small: 44, medium: 96, large: 148, hero: 200 } as const;
export type MascotSize = keyof typeof SIZE;

/**
 * How each pose behaves once it has arrived.
 *
 * **`sway` is only for the two poses that appear while nothing is being
 * read.** Greeting and thinking sit on an onboarding screen and beside a
 * spinner; a slow lean there reads as a character waiting. Pleased and
 * celebrating appear on a results screen with numbers on it, and a figure
 * that keeps moving next to text someone is reading is the thing every
 * animation brief warns about. They breathe and otherwise hold still.
 *
 * `enter` is a one-shot on arrival, and it is where the personality is: he
 * leans in to greet, settles to think, nods when pleased, and hops once when
 * there is something to celebrate. Once. Then he is calm again — a hop that
 * repeated every four seconds on a results screen would be unbearable by the
 * third lesson, and unbearable-by-the-third-lesson is the whole test.
 */
interface Behaviour {
  /** Degrees of lean at rest, or 0 for a pose that holds still. */
  readonly sway: number;
  /** One full sway, in milliseconds. Slow enough not to read as movement. */
  readonly swayMs: number;
  /** The arrival gesture: a lean, a drop, or a hop. */
  readonly enter: { readonly rotate?: number; readonly lift?: number; readonly spring?: boolean };
}

const BEHAVIOUR: Readonly<Record<MascotPose, Behaviour>> = {
  greet: { sway: 0.8, swayMs: 5200, enter: { rotate: -4 } },
  think: { sway: 0.5, swayMs: 7000, enter: { lift: -4 } },
  pleased: { sway: 0, swayMs: 0, enter: { rotate: 2.5 } },
  celebrate: { sway: 0, swayMs: 0, enter: { lift: 12, spring: true } },
};

/**
 * The guide, with something to say.
 *
 * **He can fail to load and nothing breaks.** If the drawing does not arrive,
 * the line is still there and still reads: the picture carries the warmth, the
 * text carries the meaning. An app whose results screen is blank because a
 * mascot did not download is an app that made a decoration load-bearing.
 *
 * **Changing pose is a dissolve, not a cut.** Both drawings are mounted while
 * one fades into the other, so he turns from thinking to pleased instead of
 * being replaced by a different picture of himself. It is the difference
 * between a character and a sprite sheet.
 *
 * **Under reduced motion he does not move at all** — no breath, no sway, no
 * arrival, and a pose change is instant. He is simply there, which is all he
 * ever had to be.
 */
export function Mascot({
  pose, line, size = 'medium', style,
}: {
  pose: MascotPose;
  line?: string;
  size?: MascotSize;
  style?: object;
}) {
  const systemReduced = useReducedMotion();
  const { preferences } = usePreferences();
  const setting = preferences.companion;
  // `still` is the learner asking for this character to hold still, which is a
  // different wish from the system-wide setting and is honoured on its own.
  const reduced = systemReduced || setting === 'still';
  const [failed, setFailed] = useState(false);
  const px = SIZE[size];
  const behaviour = BEHAVIOUR[pose];

  const breath = useRef(new Animated.Value(0)).current;
  const sway = useRef(new Animated.Value(0)).current;
  const enter = useRef(new Animated.Value(reduced ? 1 : 0)).current;

  // The pose being faded out. Null except during a change, so the second
  // drawing costs nothing on a screen where he never changes.
  const [outgoing, setOutgoing] = useState<MascotPose | null>(null);
  const shown = useRef(pose);
  const dissolve = useRef(new Animated.Value(1)).current;

  useEffect(() => {
    if (reduced) {
      breath.setValue(0);
      return;
    }
    // Two loops at different, deliberately unrelated periods: in step they
    // would read as a mechanism, out of step as something alive.
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

  useEffect(() => {
    if (reduced || !behaviour.sway) {
      sway.setValue(0);
      return;
    }
    const half = behaviour.swayMs / 2;
    const lean = Animated.loop(Animated.sequence([
      Animated.timing(sway, {
        toValue: 1, duration: half, easing: easing.standard, useNativeDriver: true,
      }),
      Animated.timing(sway, {
        toValue: -1, duration: behaviour.swayMs, easing: easing.standard, useNativeDriver: true,
      }),
      Animated.timing(sway, {
        toValue: 0, duration: half, easing: easing.standard, useNativeDriver: true,
      }),
    ]));
    lean.start();
    return () => lean.stop();
  }, [reduced, sway, behaviour.sway, behaviour.swayMs]);

  // Arrival, and the dissolve when the pose changes under him.
  useEffect(() => {
    const changed = shown.current !== pose;
    const previous = shown.current;
    shown.current = pose;

    if (reduced) {
      enter.setValue(1);
      dissolve.setValue(1);
      setOutgoing(null);
      return;
    }

    const running: Animated.CompositeAnimation[] = [];
    if (changed) {
      setOutgoing(previous);
      dissolve.setValue(0);
      const fade = Animated.timing(dissolve, {
        toValue: 1, duration: duration.slow, easing: easing.standard, useNativeDriver: true,
      });
      fade.start(({ finished }) => { if (finished) setOutgoing(null); });
      running.push(fade);
    }

    enter.setValue(0);
    const arrive = Animated.timing(enter, {
      toValue: 1,
      duration: behaviour.enter.spring ? duration.celebration : duration.normal,
      easing: behaviour.enter.spring ? easing.spring : easing.enter,
      useNativeDriver: true,
    });
    arrive.start();
    running.push(arrive);

    return () => running.forEach((animation) => animation.stop());
  }, [pose, reduced, enter, dissolve, behaviour.enter.spring]);

  const restingRotate = sway.interpolate({
    inputRange: [-1, 1],
    outputRange: [`${-behaviour.sway}deg`, `${behaviour.sway}deg`],
  });
  const arrivalRotate = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [`${behaviour.enter.rotate ?? 0}deg`, '0deg'],
  });
  const arrivalLift = enter.interpolate({
    inputRange: [0, 1],
    outputRange: [behaviour.enter.lift ?? 0, 0],
  });

  const figure = failed ? null : (
    <Animated.View
      style={{
        opacity: enter,
        transform: [
          { translateY: arrivalLift },
          { rotate: arrivalRotate },
          { rotate: restingRotate },
          { scale: breath.interpolate({ inputRange: [0, 1], outputRange: [1, 1.012] }) },
        ],
      }}
    >
      <View style={{ width: px, height: px }}>
        {/* The pose he is leaving, underneath, while the new one fades over it. */}
        {outgoing ? (
          <Image
            source={POSES[outgoing]}
            style={[styles.stacked, { width: px, height: px }]}
            resizeMode="contain"
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        ) : null}
        <Animated.View style={{ opacity: outgoing ? dissolve : 1 }}>
          <Image
            source={POSES[pose]}
            style={{ width: px, height: px }}
            resizeMode="contain"
            onError={() => setFailed(true)}
            // He is decoration beside text that already says it. A screen
            // reader announcing "drawing of a stoat waving" before every
            // result would be reading out the wallpaper.
            accessible={false}
            accessibilityElementsHidden
            importantForAccessibility="no"
          />
        </Animated.View>
      </View>
    </Animated.View>
  );

  // Hidden means hidden: no drawing, no bubble, no reserved space. Every
  // screen still works, because nothing was ever load-bearing on him.
  if (setting === 'off') return null;
  if (!line || setting === 'quiet') return <View style={style}>{figure}</View>;

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
  stacked: { position: 'absolute', top: 0, left: 0 },
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
