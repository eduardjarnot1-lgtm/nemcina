/**
 * Master Fuka — the app's guide.
 *
 * He is not new. He is the name on the product, and the web prototype has had
 * his voice since the beginning: short lines, a method rather than applause,
 * and never a word of blame. That voice is carried over here rather than
 * rewritten, because it was already right — "Not quite, have a look at the
 * card" is what a teacher says, and "AMAZING!!!" is what a slot machine says.
 *
 * What is new is that he can now be in a *state*. The prototype had one
 * photograph of him, which cannot look pleased or think about anything, so he
 * could only ever talk. With four drawn poses he can react, and this module
 * decides when and how.
 *
 * **Everything here is platform-free on purpose.** A screen asks what Fuka
 * would say at a moment and gets back a pose and a line; it never picks either
 * itself. That is what keeps him one character instead of a different one per
 * screen, and it is why his whole behaviour can be tested without a renderer.
 *
 * **He is deliberately rare.** There are eight moments in this file and no
 * more. He does not appear after a correct answer, or on every screen, or
 * beside every grammar rule. A guide who is always there is wallpaper; one who
 * turns up when something actually happened is worth reading.
 */

/**
 * The drawings that exist, and only those.
 *
 * Twelve emotional states map onto four poses. That is not a compromise to be
 * fixed later with more art — it is the honest shape of the character: he is
 * calm, so "proud" and "encouraging" really are the same warm half-smile, and
 * only a finished course earns the raised fists.
 */
export type MascotPose =
  /** Waving. A greeting, and nothing else — he does not wave at answers. */
  | 'greet'
  /** Book open, paw to chin. Working something out, or explaining it. */
  | 'think'
  /** Paw to chest, eyes closed. Quietly pleased. The everyday positive. */
  | 'pleased'
  /** Both fists up. Reserved for what happens once a week or less. */
  | 'celebrate';

/**
 * The moments he speaks at. Adding to this list is a product decision, not a
 * detail: each one is a new interruption in somebody's day.
 */
export type MascotMoment =
  | 'welcome'
  | 'comeback'
  | 'sessionDone'
  | 'sessionStrong'
  | 'sessionPerfect'
  | 'streakMilestone'
  | 'achievement'
  | 'thinking';

interface Script {
  readonly pose: MascotPose;
  readonly lines: readonly string[];
}

/**
 * What he says, and how he looks saying it.
 *
 * Several lines per moment, because the alternative is a character who says
 * the same eight words for a year. Every line is under twelve words and none
 * of them is an exclamation about how incredible anyone is.
 *
 * The lines that give a *technique* are the ones worth having — "say the
 * article out loud" teaches something; "well done" does not. That was already
 * his habit in the prototype and it is the trait to keep.
 */
const SCRIPT: Readonly<Record<MascotMoment, Script>> = {
  welcome: {
    pose: 'greet',
    lines: [
      'Guten Tag. Shall we begin?',
      "Let's learn some German today.",
      'A few words a day beats a hundred once a month.',
      'Ready when you are.',
    ],
  },
  /**
   * Someone who stopped for a while and came back.
   *
   * The one place where the wrong line does real damage. Nothing here mentions
   * the streak they lost, how long they were away, or what they should have
   * done. They already know. They came back anyway, which is the hard part.
   */
  comeback: {
    pose: 'greet',
    lines: [
      'Good to see you again.',
      'Welcome back. Your words are where you left them.',
      'There you are. Shall we pick something short?',
      'No rush. Start wherever you like.',
    ],
  },
  /**
   * Any ordinary ending, including a bad one.
   *
   * Not one of these lines is praise, and that is the point: this moment fires
   * at thirteen per cent as readily as at eighty. "Steady work" after a round
   * the learner mostly got wrong is hollow, and hollow is how a guide stops
   * being believed. What he offers instead is what happens next — the missed
   * words come back sooner, which is true, useful, and the same sentence at
   * either end of the range. Praise lives in the two moments below, where it
   * has been earned.
   */
  sessionDone: {
    pose: 'pleased',
    lines: [
      "That's a session done.",
      'Those come back tomorrow, a little easier.',
      'The ones you missed will come round sooner.',
      'Ready for another?',
    ],
  },
  /** Better than usual, but not flawless. Warmer, still not fireworks. */
  sessionStrong: {
    pose: 'pleased',
    lines: [
      'Nice round. They are sticking.',
      "That's the good kind of tired.",
      'Strong. You are getting faster.',
    ],
  },
  sessionPerfect: {
    pose: 'celebrate',
    lines: [
      'Every one. Well earned.',
      'Perfect round. I have notes on none of it.',
      'Not a single slip.',
    ],
  },
  streakMilestone: {
    pose: 'celebrate',
    lines: [
      'That is a habit now, not a plan.',
      'Day after day. That is the whole trick.',
      'You keep turning up. It shows.',
    ],
  },
  achievement: {
    pose: 'celebrate',
    lines: [
      'Earned, not given.',
      'That one took a while. Worth it.',
      'Look at that.',
    ],
  },
  /** While the coach is working something out. Never a joke here. */
  thinking: {
    pose: 'think',
    lines: [
      'Let me look at your answers.',
      'One moment — reading your record.',
      'Thinking.',
    ],
  },
};

export interface MascotLine {
  readonly moment: MascotMoment;
  readonly pose: MascotPose;
  readonly text: string;
}

/**
 * Pick a line for a moment, avoiding the one used last time.
 *
 * `seen` is the caller's memory — a plain map, so a screen can keep it across
 * renders and a test can pass an empty one and get a deterministic answer with
 * `pick`. Without it the random choice repeats immediately often enough to be
 * noticed, which is exactly the thing several lines were written to avoid.
 */
export function mascotLine(
  moment: MascotMoment,
  options: { seen?: Map<MascotMoment, string>; pick?: (count: number) => number } = {},
): MascotLine {
  const script = SCRIPT[moment];
  const last = options.seen?.get(moment);
  const choices = script.lines.length > 1
    ? script.lines.filter((line) => line !== last)
    : script.lines;
  const index = options.pick
    ? Math.min(Math.max(Math.floor(options.pick(choices.length)), 0), choices.length - 1)
    : Math.floor(Math.random() * choices.length);
  const text = choices[index] as string;
  options.seen?.set(moment, text);
  return { moment, pose: script.pose, text };
}

/**
 * Which session ending this was.
 *
 * "Perfect" has to be earned twice over: everything right, and enough asked
 * for it to mean anything — two-for-two is not a perfect lesson. The same rule
 * the results screen already uses for its own celebration, in one place so the
 * two cannot disagree about what just happened.
 */
export function sessionMoment(
  summary: { itemsStudied: number; incorrect: number; accuracy: number },
): MascotMoment {
  if (summary.itemsStudied >= 4 && summary.incorrect === 0 && summary.accuracy >= 1) {
    return 'sessionPerfect';
  }
  if (summary.itemsStudied >= 4 && summary.accuracy >= 0.85) return 'sessionStrong';
  return 'sessionDone';
}

/**
 * The streak lengths worth stopping for.
 *
 * Not every day. A guide who congratulates you for the fourth consecutive
 * Tuesday has nothing left to say on the hundredth, and the learner has
 * stopped reading either way.
 */
export const STREAK_MILESTONES: readonly number[] = [3, 7, 14, 30, 50, 100, 200, 365];

export const isStreakMilestone = (days: number): boolean => STREAK_MILESTONES.includes(days);

/**
 * Whether this is a return after a gap rather than an ordinary day.
 *
 * Two days is the threshold: a single missed day is a weekend, not an absence,
 * and greeting someone with "good to see you again" after one evening off is
 * the kind of thing that makes an app feel like it is keeping score.
 */
export function isComeback(lastStudied: number | null, now: number, dayMs = 86_400_000): boolean {
  if (lastStudied === null) return false;
  return now - lastStudied >= 2 * dayMs;
}
