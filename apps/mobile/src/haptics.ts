/**
 * Haptics, in four meanings rather than four APIs.
 *
 * Screens ask for what happened — a selection, a success — and this decides how
 * it should feel. That keeps the vocabulary small and stops a tap somewhere
 * getting a celebration buzz because that was the call the author remembered.
 *
 * Three rules:
 *  - **Sparingly.** A phone that buzzes at every touch is a phone people
 *    silence, and then the one buzz that mattered is gone too.
 *  - **Never on the web**, where `expo-haptics` has nothing to call.
 *  - **Off is honoured.** The learner's setting is read before every call.
 */
import { Platform } from 'react-native';
import * as Haptics from 'expo-haptics';

export type Feel = 'selection' | 'success' | 'warning' | 'achievement';

const supported = Platform.OS === 'ios' || Platform.OS === 'android';

let enabled = true;

/** Called by the preferences provider so every screen does not have to pass it. */
export function setHapticsEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Fire and forget. A haptic that fails is not worth an error path — the
 * interaction it accompanies has already happened.
 */
export function haptic(feel: Feel): void {
  if (!supported || !enabled) return;
  try {
    switch (feel) {
      case 'selection':
        void Haptics.selectionAsync();
        break;
      case 'success':
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Success);
        break;
      case 'warning':
        // Deliberately the *warning* pattern and not `Error`: a wrong answer is
        // information, and the phone should not tell someone they failed.
        void Haptics.notificationAsync(Haptics.NotificationFeedbackType.Warning);
        break;
      case 'achievement':
        void Haptics.impactAsync(Haptics.ImpactFeedbackStyle.Medium);
        break;
    }
  } catch {
    /* no haptic is not a problem worth surfacing */
  }
}
