/**
 * The coach: usage limits, a closed set of intents, and a prompt built here.
 *
 * Three rules shape this file, and all three are about what the client is not
 * allowed to do (§11, §31):
 *
 *   1. **The client never sends a prompt.** It sends an intent from a fixed
 *      list and its own evidence. The wording that reaches the model is written
 *      here. A free-text field forwarded to a model is a bill anyone can run up
 *      and an instruction anyone can inject.
 *   2. **The client never sends prose.** Everything in the evidence is a number
 *      or a short, single-line label, checked on arrival. A German headword is
 *      64 characters; anything longer is not a headword.
 *   3. **The quota is counted here.** A phone that says it has three requests
 *      left is a phone that will say it has three requests left forever.
 *
 * And one rule about what the model may do: it may only rephrase what the
 * evidence already says. It is told so, it is given nothing else, and the
 * deterministic advice remains what the app shows when there is no model.
 */

import type { DatabaseSync } from 'node:sqlite';
import type { Account } from './accounts.ts';
import { AuthError } from './accounts.ts';
import type { ServerConfig } from './config.ts';

/** What the learner can ask for. There is no "anything else". */
export const COACH_INTENTS = ['progress', 'what-next', 'encourage'] as const;
export type CoachIntent = (typeof COACH_INTENTS)[number];

export const isCoachIntent = (value: unknown): value is CoachIntent =>
  typeof value === 'string' && (COACH_INTENTS as readonly string[]).includes(value);

/** A headword and its meaning, as the client may report them. Nothing longer. */
const MAX_LABEL = 64;
const MAX_WEAK_ITEMS = 5;

export interface SafeWeakItem {
  readonly term: string;
  readonly translation: string;
  readonly incorrect: number;
  readonly correct: number;
}

/**
 * The evidence, after it has been made safe to put in a prompt.
 *
 * Deliberately a different type from the core's `CoachEvidence`: what arrives
 * over a network is a stranger's guess at that shape, and the difference
 * between the two types is the checking.
 */
export interface SafeEvidence {
  readonly seen: number;
  readonly learned: number;
  readonly mastered: number;
  readonly due: number;
  readonly weak: number;
  readonly total: number;
  readonly streak: number;
  readonly accuracy: number | null;
  readonly weakest: readonly SafeWeakItem[];
  readonly empty: boolean;
}

const wholeNumber = (value: unknown, cap = 1_000_000): number => {
  const number = typeof value === 'number' && Number.isFinite(value) ? Math.floor(value) : 0;
  return Math.min(Math.max(number, 0), cap);
};

/**
 * A label safe to place in a prompt.
 *
 * Control and formatting characters are removed rather than escaped: a headword
 * contains none, so anything carrying them is not a headword, and the cheapest
 * way to be sure nothing steers the model is for the text to be one line of a
 * bounded length.
 */
const label = (value: unknown): string => {
  if (typeof value !== 'string') return '';
  return value
    .replace(/\p{C}+/gu, ' ')
    .replace(/\s+/g, ' ')
    .trim()
    .slice(0, MAX_LABEL);
};

export function readEvidence(value: unknown): SafeEvidence {
  const raw = (typeof value === 'object' && value !== null ? value : {}) as Record<string, unknown>;
  const vocabulary = (typeof raw.vocabulary === 'object' && raw.vocabulary !== null
    ? raw.vocabulary : {}) as Record<string, unknown>;
  const streak = (typeof raw.streak === 'object' && raw.streak !== null
    ? raw.streak : {}) as Record<string, unknown>;

  const weakest: SafeWeakItem[] = [];
  if (Array.isArray(raw.weakest)) {
    for (const entry of raw.weakest.slice(0, MAX_WEAK_ITEMS)) {
      const item = (typeof entry === 'object' && entry !== null ? entry : {}) as Record<string, unknown>;
      const term = label(item.term);
      if (!term) continue;
      weakest.push({
        term,
        translation: label(item.translation),
        incorrect: wholeNumber(item.incorrect, 9999),
        correct: wholeNumber(item.correct, 9999),
      });
    }
  }

  const accuracy = typeof raw.recentAccuracy === 'number' && Number.isFinite(raw.recentAccuracy)
    ? Math.min(Math.max(raw.recentAccuracy, 0), 1)
    : null;

  return {
    seen: wholeNumber(vocabulary.seen),
    learned: wholeNumber(vocabulary.learned),
    mastered: wholeNumber(vocabulary.mastered),
    due: wholeNumber(vocabulary.due),
    weak: wholeNumber(vocabulary.weak),
    total: wholeNumber(vocabulary.total),
    streak: wholeNumber(streak.current, 9999),
    accuracy,
    weakest,
    empty: raw.empty === true,
  };
}

// --- the prompt ---------------------------------------------------------------

/**
 * What the model is allowed to be.
 *
 * The prohibition is the point. A coach that says "I see you've mastered travel
 * vocabulary" when the learner has not teaches them the app is not really
 * looking, and after that nothing it says counts either — so the model is given
 * the facts, told they are the only facts, and told to say nothing else.
 */
export const SYSTEM_PROMPT = [
  'You are a coach inside a German-learning app, speaking to one learner.',
  '',
  'The message below contains every fact you have about them. Rules:',
  '- Use only those facts. Do not state or imply anything else about what they',
  '  have studied, know, or find difficult.',
  '- If the facts say they have done nothing, say that plainly and encourage a',
  '  start. Do not invent a history.',
  '- Do not teach German, translate, or correct anything. Another part of the',
  '  app does that, from sourced material.',
  '- Two or three sentences. No headings, no lists, no emoji.',
  '- Address the learner directly and plainly.',
].join('\n');

const INTENT_ASK: Record<CoachIntent, string> = {
  progress: 'Summarise where they are, in two or three sentences.',
  'what-next': 'Say what they should do in their next session, and why.',
  encourage: 'Give them one honest reason to keep going, drawn from the facts.',
};

/** The user message: the facts as JSON, then the ask. Nothing from the client. */
export function buildPrompt(intent: CoachIntent, evidence: SafeEvidence): string {
  const facts = {
    wordsStudied: evidence.seen,
    wordsLearned: evidence.learned,
    wordsMastered: evidence.mastered,
    wordsInCourse: evidence.total,
    reviewsDue: evidence.due,
    wordsRepeatedlyWrong: evidence.weak,
    dayStreak: evidence.streak,
    recentAccuracyPercent: evidence.accuracy === null ? null : Math.round(evidence.accuracy * 100),
    hardestWords: evidence.weakest.map((item) => ({
      german: item.term,
      english: item.translation,
      timesWrong: item.incorrect,
      timesRight: item.correct,
    })),
    hasDoneNothingYet: evidence.empty,
  };
  return `Facts:\n${JSON.stringify(facts, null, 2)}\n\n${INTENT_ASK[intent]}`;
}

// --- the provider -------------------------------------------------------------

export interface CoachProvider {
  readonly name: string;
  respond(system: string, user: string): Promise<string>;
}

export class ProviderError extends Error {}

/**
 * The provider that exists when no key is configured.
 *
 * Not a stub that returns plausible text — text from a stub would be exactly
 * the fabrication this module is built to prevent. It refuses, and the endpoint
 * answers honestly that no model is configured.
 */
export const NO_PROVIDER: CoachProvider = {
  name: 'none',
  async respond(): Promise<string> {
    throw new ProviderError('no model is configured');
  },
};

// --- usage limits -------------------------------------------------------------

const DAY_MS = 86_400_000;

export interface Quota {
  readonly limit: number;
  readonly used: number;
  readonly remaining: number;
}

export class CoachUsage {
  readonly #db: DatabaseSync;
  readonly #config: ServerConfig;
  readonly #now: () => number;

  constructor(db: DatabaseSync, config: ServerConfig, now: () => number = Date.now) {
    this.#db = db;
    this.#config = config;
    this.#now = now;
  }

  limitFor(account: Account, at = this.#now()): number {
    const premium = account.tier === 'premium' && account.premiumUntil > at;
    return premium ? this.#config.coachPremiumPerDay : this.#config.coachFreePerDay;
  }

  quota(account: Account): Quota {
    const limit = this.limitFor(account);
    const used = this.#used(account.id);
    return { limit, used, remaining: Math.max(0, limit - used) };
  }

  /** Take one request from today's allowance, or refuse. */
  consume(account: Account): Quota {
    const limit = this.limitFor(account);
    const used = this.#used(account.id);
    if (used >= limit) {
      throw new AuthError('You have used the coach as much as you can today.', 429);
    }
    this.#db.prepare(`
      INSERT INTO coach_usage (user_id, day, count) VALUES (?, ?, 1)
      ON CONFLICT(user_id, day) DO UPDATE SET count = count + 1
    `).run(account.id, this.#day());
    return { limit, used: used + 1, remaining: Math.max(0, limit - used - 1) };
  }

  /**
   * Give one back.
   *
   * Called when the model call fails after the quota was taken. Charging a
   * learner for a request that produced nothing is the kind of small unfairness
   * never worth the code it saves.
   */
  refund(account: Account): void {
    this.#db.prepare(
      'UPDATE coach_usage SET count = MAX(0, count - 1) WHERE user_id = ? AND day = ?',
    ).run(account.id, this.#day());
  }

  #day(): number {
    return Math.floor(this.#now() / DAY_MS);
  }

  #used(userId: string): number {
    const row = this.#db.prepare(
      'SELECT count FROM coach_usage WHERE user_id = ? AND day = ?',
    ).get(userId, this.#day()) as { count: number } | undefined;
    return Number(row?.count ?? 0);
  }
}
