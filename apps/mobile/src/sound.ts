/**
 * Sound, in five meanings — and nothing to play them with yet.
 *
 * The shape mirrors `haptics.ts` deliberately: screens say what happened and
 * this decides what it should sound like, so the vocabulary stays small and a
 * screen never reaches for a file path.
 *
 * **Nothing is registered, so every call is a no-op.** That is the honest
 * state of it: the app ships no audio, and `preferences.sound` defaults to off
 * because a setting that promises a sound it cannot play is worse than no
 * setting. This module exists so that adding the assets is a change to one
 * file rather than a change to every screen — not so the app can claim a
 * feature it does not have.
 *
 * When there are assets, `register` is called once at startup with a player
 * built on whatever audio library is chosen then. No dependency is added now:
 * pulling in a media library for five files that do not exist would be paying
 * the bundle cost for nothing.
 */

export type Cue = 'correct' | 'incorrect' | 'lessonComplete' | 'achievement' | 'levelUp';

/** What a player has to be able to do. Kept this small on purpose. */
export interface Player {
  play(cue: Cue): void;
}

let player: Player | null = null;
let enabled = false;

/**
 * Install the thing that actually makes noise.
 *
 * Until this is called, `cue()` does nothing at all — which is why the
 * preference can safely exist before the audio does.
 */
export function register(value: Player | null): void {
  player = value;
}

/** True only when there is both a player and permission to use it. */
export function soundAvailable(): boolean {
  return player !== null;
}

/** Called by the preferences provider, the same way haptics is. */
export function setSoundEnabled(value: boolean): void {
  enabled = value;
}

/**
 * Fire and forget, like a haptic: the moment it accompanies has already
 * happened, and a cue that fails is not worth an error path.
 *
 * Sound is the most intrusive feedback the app has — it carries past the
 * person holding the phone — so it stays off unless asked for twice: once by
 * registering a player, once by the learner's own setting.
 */
export function cue(name: Cue): void {
  if (!enabled || !player) return;
  try {
    player.play(name);
  } catch {
    /* silence is the fallback, and it is a perfectly good one */
  }
}
