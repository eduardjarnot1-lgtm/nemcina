import { useCallback, type ReactNode } from 'react';
import { Pressable, type StyleProp, type ViewStyle } from 'react-native';
import { Animated, usePressScale, usePulse, useEarned } from '../motion';
import { haptic } from '../haptics';

/**
 * Anything a learner picks from a set: a level, a session length, a setting.
 *
 * Only the behaviour is shared — the press response, the selection feel and
 * the small acknowledgement when a choice becomes the chosen one. Each screen
 * keeps its own styling, because these rows do not look alike and making them
 * look alike was never the point. Before this, three screens had three
 * hand-rolled `Pressable`s and none of them responded to a tap at all.
 *
 * The pulse fires on the edge, not on render, so arriving at a screen with a
 * choice already made is silent. Re-announcing an old decision is noise.
 */
export function Selectable({
  selected, onPress, style, children, accessibilityLabel,
}: {
  selected: boolean;
  onPress: () => void;
  style?: StyleProp<ViewStyle>;
  children: ReactNode;
  accessibilityLabel?: string;
}) {
  const press = usePressScale();
  const { pulse, style: pulseStyle } = usePulse('soft');

  useEarned(selected, pulse);

  const handle = useCallback(() => {
    haptic('selection');
    onPress();
  }, [onPress]);

  return (
    <Pressable
      accessibilityRole="button"
      accessibilityState={{ selected }}
      accessibilityLabel={accessibilityLabel}
      onPress={handle}
      onPressIn={press.onPressIn}
      onPressOut={press.onPressOut}
    >
      <Animated.View style={[style, press.style, pulseStyle]}>
        {children}
      </Animated.View>
    </Pressable>
  );
}
