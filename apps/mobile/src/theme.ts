/**
 * One place for colour, spacing and type.
 *
 * Not a design system — a single source for the handful of values that must not
 * be retyped per screen, so a change to the accent colour is one edit and not a
 * search-and-replace that misses three files.
 */
import { Platform } from 'react-native';

export const palette = {
  /** Warm off-white. Paper, not screen. */
  background: '#f7f5f2',
  /** Cards stay white, so they lift off the background rather than blend. */
  surface: '#ffffff',
  border: '#e6e1da',
  /** Graphite with a little warmth in it, to sit on paper rather than on grey. */
  text: '#23201d',
  textMuted: '#6e6862',
  /**
   * Between `text` and `textMuted`, for a line that is content but secondary —
   * the English under a German example. Quieter than the sentence it glosses,
   * clearly louder than the note under it.
   */
  textSecond: '#4c4741',
  /** Burgundy: primary actions, the active tab, the thing to press. */
  accent: '#ac293d',
  accentSoft: '#f7e7ea',
  /**
   * Gold, and the two rules that come with it.
   *
   * `gold` is 2.07:1 on the background. That is a fill, a rule, a medal — it
   * is never text, and white on it is 2.25:1, so a gold badge carries graphite
   * (7.21:1) rather than white. `goldInk` is the same colour taken down until
   * it can be read: 4.65:1 on the background, which is what a milestone
   * *label* uses.
   *
   * Reserved for milestones. A second accent that turns up on ordinary
   * controls stops being a reward and becomes decoration.
   */
  gold: '#d5a63a',
  goldInk: '#8a6a12',
  goldSoft: '#faf1dc',
  /**
   * Right, nearly, wrong. These carry meaning rather than brand, so they did
   * not move with the rest of the palette — a learner who has learned that
   * green means right should not have to learn it again.
   */
  correct: '#1f7a4d',
  correctSoft: '#e6f3ec',
  wrong: '#b3261e',
  wrongSoft: '#fbe9e7',
  almost: '#8a6100',
  almostSoft: '#fdf1d6',
} as const;

export const spacing = { xs: 4, sm: 8, md: 16, lg: 24, xl: 32 } as const;

export const radius = { sm: 8, md: 12, lg: 20 } as const;

export const type = {
  display: { fontSize: 30, fontWeight: '700' },
  title: { fontSize: 22, fontWeight: '700' },
  heading: { fontSize: 17, fontWeight: '600' },
  body: { fontSize: 16, fontWeight: '400' },
  label: { fontSize: 13, fontWeight: '600' },
  caption: { fontSize: 13, fontWeight: '400' },
} as const;

/** The system font stack, which on both platforms is the one people read fastest. */
export const fontFamily = Platform.select({ ios: 'System', default: 'sans-serif' });
