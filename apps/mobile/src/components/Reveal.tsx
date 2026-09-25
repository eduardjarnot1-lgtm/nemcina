import type { ReactNode } from 'react';
import type { ViewStyle } from 'react-native';
import { Animated, useEntrance } from '../motion';

/**
 * Rows a virtualised list has already shown once.
 *
 * `FlatList` unmounts what scrolls out of its window and mounts it again on the
 * way back, so a row that reveals itself on mount reveals itself every time it
 * returns. On a long list that reads as cards that will not settle, which is
 * the one thing an entrance animation must never become. Remembering the keys
 * that have played makes the reveal what it claims to be — the list arriving,
 * once — and costs one string per row.
 *
 * Module-level on purpose: it has to outlive the component that was unmounted.
 * It is cleared only when the app is.
 */
const shown = new Set<string>();

/**
 * Content arriving on a screen, one beat after the thing above it.
 *
 * The stagger is what makes a screen read as assembled rather than as a flash
 * of finished layout. It runs once and then the element is still: a home screen
 * where things keep moving is a home screen nobody can read.
 *
 * `index` is the position in the run, not a duration — screens say "I am third"
 * and the system decides what that is worth, so the rhythm stays the same
 * everywhere and can be changed in one place.
 *
 * `once` is the identity of the thing being revealed, and is required for
 * anything inside a `FlatList` or `SectionList`. Without it the row animates
 * again on every scroll back.
 */
export function Reveal({
  index = 0, once, style, children,
}: { index?: number; once?: string; style?: ViewStyle; children: ReactNode }) {
  const already = once !== undefined && shown.has(once);
  if (once !== undefined) shown.add(once);
  // Capped so a long list never leaves the last card arriving noticeably late.
  const entrance = useEntrance(already ? 'done' : 'mount', {
    delay: already ? 0 : Math.min(index, 4) * 60,
  });
  return <Animated.View style={[style, already ? undefined : entrance]}>{children}</Animated.View>;
}
