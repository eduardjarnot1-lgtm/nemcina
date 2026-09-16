/** Compact daily history survives trimming the recent answer log. */
import type { AttemptRecord } from './types.ts';
import { xpFor } from './achievements.ts';
import { DAY_MS, localDay, streak } from './stats.ts';

export interface StudyDay {
  readonly userId: string;
  readonly day: number;
  readonly count: number;
  /** First correct answer per item; no answer text is retained here. */
  readonly awards: Readonly<Record<string, { readonly at: number; readonly xp: number }>>;
}

export function addStudyAttempt(
  days: readonly StudyDay[], attempt: AttemptRecord, offsetMinutes = 0,
): readonly StudyDay[] {
  const day = localDay(attempt.at, offsetMinutes);
  const index = days.findIndex(d => d.userId === attempt.userId && d.day === day);
  const previous = days[index] ?? { userId: attempt.userId, day, count: 0, awards: {} };
  const awards = { ...previous.awards };
  // JSON keys keep arbitrary item IDs (including __proto__) as ordinary keys.
  const key = JSON.stringify(attempt.itemId);
  const award = awards[key];
  if (attempt.correct && (!award || attempt.at < award.at)) {
    awards[key] = { at: attempt.at, xp: xpFor(attempt) };
  }
  const next = { ...previous, count: previous.count + 1, awards };
  return index < 0 ? [...days, next] : days.map((d, i) => i === index ? next : d);
}

export function studySummary(
  days: readonly StudyDay[],
  options: { now?: number; offsetMinutes?: number } = {},
) {
  const today = localDay(options.now ?? Date.now(), options.offsetMinutes ?? 0);
  const valid = days.filter(d => d.day <= today);
  return {
    xp: valid.reduce((total, d) => total + Object.values(d.awards).reduce((n, a) => n + a.xp, 0), 0),
    today: valid.filter(d => d.day === today).reduce((n, d) => n + d.count, 0),
    streak: streak(valid.map(d => ({ at: d.day * DAY_MS })), { now: today * DAY_MS }),
    week: Array.from({ length: 7 }, (_, i) => {
      const day = today - 6 + i;
      return { day, count: valid.filter(d => d.day === day).reduce((n, d) => n + d.count, 0) };
    }),
  };
}

/** Validate the persisted aggregate before showing its numbers to the learner. */
export function isStudyDay(value: unknown): value is StudyDay {
  if (!value || typeof value !== 'object') return false;
  const d = value as Record<string, unknown>;
  if (typeof d.userId !== 'string' || !Number.isSafeInteger(d.day)
    || !Number.isSafeInteger(d.count) || (d.count as number) < 0
    || !d.awards || typeof d.awards !== 'object' || Array.isArray(d.awards)) return false;
  return Object.values(d.awards).every(a => a && typeof a === 'object'
    && Number.isFinite(a.at) && Number.isSafeInteger(a.xp) && a.xp >= 0 && a.xp <= 3);
}
