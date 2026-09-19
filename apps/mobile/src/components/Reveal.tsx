import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { Animated, useEntrance } from '../motion';

/**
 * Content arriving on a screen, one beat after the thing above it.
 *
 * The stagger is what makes a screen read as assembled rather than as a flash
 * of finished layout. It runs once on mount and then the element is still: a
 * home screen where things keep moving is a home screen nobody can read.
 *
 * `index` is the position in the run, not a duration — screens say "I am third"
 * and the system decides what that is worth, so the rhythm stays the same
 * everywhere and can be changed in one place.
 */
export function Reveal({
  index = 0, style, children,
}: { index?: number; style?: ViewStyle; children: ReactNode }) {
  // Capped so a long list never leaves the last card arriving noticeably late.
  const entrance = useEntrance('mount', { delay: Math.min(index, 4) * 60 });
  return <Animated.View style={[style, entrance]}>{children}</Animated.View>;
}
