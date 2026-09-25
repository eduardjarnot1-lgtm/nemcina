/**
 * Colour that means something in grammar.
 *
 * One hue per grammatical family, used everywhere that family appears: the
 * chip on a topic card, the rail down its explanation, the level index. A topic
 * about the Dativ and a topic about articles are both about the noun phrase, so
 * they read as the same kind of thing before a word is read.
 *
 * Two rules keep this from being decoration:
 *
 *  - **The family comes from the corpus**, via `grammarFamily`, not from the
 *    screen. Nothing picks a colour because it looked nice on that page.
 *  - **Colour never carries meaning alone.** Every place a hue appears, the
 *    family is also named in words. Someone who cannot distinguish these hues
 *    loses a grouping cue and no information.
 *
 * The tones are muted on purpose. Six saturated colours on one screen is a
 * toy; these sit against `palette.surface` at text contrast and read as
 * stationery rather than as highlighter.
 */
import type { GrammarFamily, MarkRole } from '@nemcina/core';

export interface FamilyTone {
  /** For text and the accent rail — meets contrast on `surface`. */
  readonly ink: string;
  /** For chip and rail backgrounds. */
  readonly wash: string;
  /** What this family is, in the interface language. Colour never travels alone. */
  readonly label: string;
}

export const familyTone: Readonly<Record<GrammarFamily, FamilyTone>> = {
  verb: { ink: '#b3261e', wash: '#fbe9e7', label: 'Verbs' },
  nounPhrase: { ink: '#6b3fa0', wash: '#f1eafa', label: 'Nouns & articles' },
  sentence: { ink: '#1f6f8b', wash: '#e6f2f6', label: 'Sentence structure' },
  connector: { ink: '#8a6100', wash: '#fdf1d6', label: 'Linking clauses' },
  modifier: { ink: '#1f7a4d', wash: '#e4f4ec', label: 'Adjectives & adverbs' },
  other: { ink: '#4a4a57', wash: '#eeeef2', label: 'Word formation' },
};

/**
 * Colour for a highlighted word inside an example, by its word class.
 *
 * The same four hues the families already use, chosen so a class means the same
 * thing wherever it appears: a verb is the red of the Verbs family, a connector
 * the amber of Linking clauses, a question word the teal of Sentence structure.
 * A preposition takes the purple of Nouns & articles, because a preposition is
 * what governs the noun phrase after it — the tie is the point.
 *
 * The same two rules as above apply, and the second one does real work here:
 * `ExampleList` prints a legend naming every class the topic actually uses, so
 * the colours are a shortcut for someone who has read it once and never the
 * only way to know what is marked.
 *
 * A mark with no class renders in the neutral accent instead. That is the
 * common case — 401 of 619 marks — and it means "this is the form the topic
 * teaches", which is all the build knows about it.
 */
export interface RoleTone {
  readonly ink: string;
  readonly wash: string;
  readonly label: string;
}

export const roleTone: Readonly<Record<MarkRole, RoleTone>> = {
  verb: { ink: '#b3261e', wash: '#fbe9e7', label: 'verb' },
  conj: { ink: '#8a6100', wash: '#fdf1d6', label: 'connector' },
  prep: { ink: '#6b3fa0', wash: '#f1eafa', label: 'preposition' },
  q: { ink: '#1f6f8b', wash: '#e6f2f6', label: 'question word' },
};
