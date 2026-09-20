/**
 * The learning funnel, as events — with nowhere to send them.
 *
 * The point of this file is to make it possible to find out later whether a
 * change helped. "The animations feel better" is not a claim anybody can check;
 * "more sessions reach their summary" is. Without somewhere to record the
 * steps, every future UX decision is a matter of taste.
 *
 * Three rules, and the first one is why there is no sink:
 *
 *  - **Nothing leaves the device.** No sink is installed, so `track` does
 *    nothing. Adding one is a deliberate act by whoever operates this app, and
 *    it belongs in a privacy notice before it belongs in code.
 *  - **Only the funnel.** These events say that a lesson started and whether it
 *    finished. There is no event for what was answered, which word it was, how
 *    long a person hesitated, or anything else that would describe an
 *    individual rather than a flow.
 *  - **Never load-bearing.** A sink that throws must not break a lesson, so
 *    failures are swallowed. Nothing in the app reads these back.
 */

/**
 * The steps worth counting.
 *
 * Deliberately few. An event for everything is an event for nothing, and a
 * long list is an invitation to start logging behaviour rather than progress.
 */
export type LearningEvent =
  | { readonly name: 'lesson_started'; readonly lessonId: string; readonly items: number }
  | { readonly name: 'lesson_completed'; readonly items: number; readonly accuracy: number }
  | { readonly name: 'lesson_abandoned'; readonly answered: number; readonly items: number }
  | { readonly name: 'review_started'; readonly due: number }
  | { readonly name: 'streak_extended'; readonly days: number }
  | { readonly name: 'achievement_unlocked'; readonly id: string };

export interface Sink {
  record(event: LearningEvent): void;
}

let sink: Sink | null = null;

/**
 * Install somewhere for events to go.
 *
 * Until this is called — and nothing in the app calls it — every event is
 * discarded. That is the intended shipping state.
 */
export function install(value: Sink | null): void {
  sink = value;
}

/** Fire and forget. Analytics must never be able to cost a learner an answer. */
export function track(event: LearningEvent): void {
  if (!sink) return;
  try {
    sink.record(event);
  } catch {
    /* a measurement that fails is not worth interrupting a lesson for */
  }
}
