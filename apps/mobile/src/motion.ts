/**
 * The motion system.
 *
 * One place for every duration, curve and animation this app uses, for the same
 * reason `theme.ts` exists for colour: a screen that reaches for 240ms because
 * it felt about right is how an interface ends up with nine slightly different
 * speeds and no way to change any of them.
 *
 * Two rules hold everywhere:
 *
 *  - **Only `transform` and `opacity` are animated.** Both are composited off
 *    the main thread with `useNativeDriver`, so a lesson stays at frame rate
 *    while the JS thread is busy saving progress. Animating width, height or a
 *    colour would put a layout or paint pass in the middle of every answer.
 *  - **Reduced motion is a real setting, not a nicety.** When it is on, the
 *    animations do not merely shorten: movement is removed and the state change
 *    still happens, instantly and fully. Nothing in this app is understandable
 *    only if it moved.
 */
import { useCallback, useEffect, useMemo, useRef, useState } from 'react';
import { AccessibilityInfo, Animated, Easing } from 'react-native';

/**
 * How long things take.
 *
 * `instant` is the press response — below about 80ms a tap reads as immediate.
 * `fast` is the working speed of the lesson: a learner answering quickly must
 * never wait on it. `celebration` is the only value allowed to be slow, and it
 * is reserved for things that happen once a lesson or less.
 */
export const duration = {
  instant: 70,
  fast: 140,
  normal: 220,
  slow: 320,
  celebration: 600,
} as const;

export const easing = {
  /** Anything already on screen changing in place. */
  standard: Easing.bezier(0.2, 0, 0, 1),
  /** Entering: decelerate, so it arrives rather than stops. */
  enter: Easing.out(Easing.cubic),
  /** Leaving: accelerate away; nobody needs to watch it go. */
  exit: Easing.in(Easing.cubic),
  /** A little overshoot. Rewards only — never navigation. */
  spring: Easing.bezier(0.2, 1.1, 0.3, 1),
} as const;

/**
 * Whether the person asked the system to reduce motion.
 *
 * Read once and then kept current, because someone can change it while the app
 * is open and the next answer should already respect it.
 */
export function useReducedMotion(): boolean {
  const [reduced, setReduced] = useState(false);
  useEffect(() => {
    let alive = true;
    AccessibilityInfo.isReduceMotionEnabled()
      .then((value) => { if (alive) setReduced(value); })
      .catch(() => { /* a platform that cannot say is a platform that does not want it */ });
    const subscription = AccessibilityInfo.addEventListener('reduceMotionChanged', setReduced);
    return () => { alive = false; subscription.remove(); };
  }, []);
  return reduced;
}

interface Timing {
  readonly toValue: number;
  readonly duration: number;
  readonly easing?: (value: number) => number;
  readonly delay?: number;
}

const timing = (value: Animated.Value, config: Timing) =>
  Animated.timing(value, {
    toValue: config.toValue,
    duration: config.duration,
    delay: config.delay ?? 0,
    easing: config.easing ?? easing.standard,
    useNativeDriver: true,
  });

/**
 * The press response every tappable thing shares.
 *
 * Down is faster than up on purpose: the acknowledgement should land under the
 * finger, while the release can afford to settle. The scale is small — a button
 * that visibly bounces reads as a toy by the fiftieth answer.
 */
export function usePressScale(to = 0.97) {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;

  const onPressIn = useCallback(() => {
    if (reduced) return;
    timing(scale, { toValue: to, duration: duration.instant }).start();
  }, [reduced, scale, to]);

  const onPressOut = useCallback(() => {
    if (reduced) return;
    timing(scale, { toValue: 1, duration: duration.fast, easing: easing.spring }).start();
  }, [reduced, scale]);

  return { scale, onPressIn, onPressOut, style: { transform: [{ scale }] } };
}

/**
 * Fade-and-rise on mount, restarted whenever `key` changes.
 *
 * This is what carries one question out and the next one in. The rise is small
 * and the fade does most of the work, so a learner answering fast sees content
 * replaced rather than content travelling.
 */
export function useEntrance(key: unknown, options: { distance?: number; delay?: number } = {}) {
  const reduced = useReducedMotion();
  const progress = useRef(new Animated.Value(reduced ? 1 : 0)).current;
  const distance = options.distance ?? 8;

  useEffect(() => {
    if (reduced) {
      progress.setValue(1);
      return;
    }
    progress.setValue(0);
    const animation = timing(progress, {
      toValue: 1,
      duration: duration.normal,
      delay: options.delay ?? 0,
      easing: easing.enter,
    });
    animation.start();
    return () => animation.stop();
  }, [key, reduced, progress, options.delay]);

  const style = useMemo(() => ({
    opacity: progress,
    transform: [{
      translateY: progress.interpolate({ inputRange: [0, 1], outputRange: [distance, 0] }),
    }],
  }), [progress, distance]);

  return style;
}

/**
 * A short horizontal shake, for a wrong answer.
 *
 * Deliberately small and over quickly. It says "not that" — it is not a
 * punishment, and it must not delay the learner reading the correction.
 */
export function useShake() {
  const reduced = useReducedMotion();
  const offset = useRef(new Animated.Value(0)).current;

  const shake = useCallback(() => {
    if (reduced) return;
    offset.setValue(0);
    Animated.sequence([
      timing(offset, { toValue: -1, duration: 50 }),
      timing(offset, { toValue: 1, duration: 60 }),
      timing(offset, { toValue: -0.5, duration: 55 }),
      timing(offset, { toValue: 0, duration: 55 }),
    ]).start();
  }, [reduced, offset]);

  const style = useMemo(() => ({
    transform: [{
      translateX: offset.interpolate({ inputRange: [-1, 1], outputRange: [-6, 6] }),
    }],
  }), [offset]);

  return { shake, style };
}

/**
 * How much a pulse is worth.
 *
 * The whole point of having names here is that the app cannot reward a correct
 * answer as loudly as a finished course. `soft` happens many times a minute and
 * has to stay almost unnoticed; `strong` is for something a learner earned once
 * and will not see again for days. Scattering raw scale values through screens
 * is how every event ends up equally exciting, which is the same as none of
 * them being.
 */
export const emphasis = {
  soft: 1.035,
  strong: 1.08,
} as const;

export type Emphasis = keyof typeof emphasis;

/**
 * One pulse, for something that just went right.
 *
 * Up and back in under a fifth of a second at `soft`. Anything longer and the
 * learner is waiting on applause instead of answering the next question. A
 * `strong` pulse is slower because it is allowed to be: it is reserved for
 * things that happen once a lesson or less.
 */
export function usePulse(strength: Emphasis = 'soft') {
  const reduced = useReducedMotion();
  const scale = useRef(new Animated.Value(1)).current;
  const to = emphasis[strength];
  const settle = strength === 'strong' ? duration.normal : duration.fast;

  const pulse = useCallback(() => {
    if (reduced) return;
    Animated.sequence([
      timing(scale, { toValue: to, duration: duration.instant, easing: easing.enter }),
      timing(scale, { toValue: 1, duration: settle, easing: easing.spring }),
    ]).start();
  }, [reduced, scale, to, settle]);

  return { pulse, style: { transform: [{ scale }] } };
}

/**
 * Fires once, when something stops being false.
 *
 * An achievement is earned at the moment a lesson pushes the count over the
 * line, and that is the only moment worth marking. This watches a boolean and
 * calls back on the false-to-true edge only — never on mount, so opening the
 * profile does not replay every badge the learner already has. That would be
 * celebrating the past, which is noise.
 */
export function useEarned(done: boolean, onEarned: () => void) {
  const was = useRef(done);
  useEffect(() => {
    if (done && !was.current) onEarned();
    was.current = done;
  }, [done, onEarned]);
}

/**
 * A number that counts to its new value instead of jumping.
 *
 * Driven by a listener rather than the native driver, because the value has to
 * reach JavaScript to be rendered as text. That is fine: it runs for a fraction
 * of a second, once, on a results screen — not during the lesson.
 */
export function useCountUp(target: number, options: { duration?: number; enabled?: boolean } = {}) {
  const reduced = useReducedMotion();
  const enabled = options.enabled ?? true;
  const [shown, setShown] = useState(reduced || !enabled ? target : 0);
  const value = useRef(new Animated.Value(0)).current;

  useEffect(() => {
    if (reduced || !enabled) {
      setShown(target);
      return;
    }
    value.setValue(0);
    const id = value.addListener(({ value: v }) => setShown(Math.round(v * target)));
    const animation = Animated.timing(value, {
      toValue: 1,
      duration: options.duration ?? duration.celebration,
      easing: easing.enter,
      useNativeDriver: false,
    });
    animation.start(({ finished }) => { if (finished) setShown(target); });
    return () => {
      animation.stop();
      value.removeListener(id);
    };
  }, [target, reduced, enabled, value, options.duration]);

  return shown;
}

/**
 * A bar that travels to its new value.
 *
 * The width itself is never animated — the fill is laid out at full width and
 * moved with `scaleX`, so the progress bar costs a composite rather than a
 * layout pass on every answer.
 */
export function useProgressScale(value: number) {
  const reduced = useReducedMotion();
  const clamped = Math.max(0, Math.min(1, Number.isFinite(value) ? value : 0));
  const scale = useRef(new Animated.Value(clamped)).current;
  const first = useRef(true);

  useEffect(() => {
    if (first.current) {
      first.current = false;
      scale.setValue(clamped);
      return;
    }
    if (reduced) {
      scale.setValue(clamped);
      return;
    }
    const animation = timing(scale, {
      toValue: clamped,
      duration: duration.slow,
      easing: easing.standard,
    });
    animation.start();
    return () => animation.stop();
  }, [clamped, reduced, scale]);

  return scale;
}

export { Animated };
