/**
 * One place for colour, spacing and type.
 *
 * Not a design system — a single source for the handful of values that must not
 * be retyped per screen, so a change to the accent colour is one edit and not a
 * search-and-replace that misses three files.
 */
import { Platform } from 'react-native';

export const palette = {
  background: '#f7f7f9',
  surface: '#ffffff',
  border: '#e3e3e9',
  text: '#16161d',
  textMuted: '#6c6c7a',
  /**
   * Between `text` and `textMuted`, for a line that is content but secondary —
   * the English under a German example. Quieter than the sentence it glosses,
   * clearly louder than the note under it.
   */
  textSecond: '#4a4a57',
  accent: '#2f5bd7',
  accentSoft: '#e8eefc',
  correct: '#1f7a4d',
  correctSoft: '#e4f4ec',
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
