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
 * Most take the hue their grammatical family already uses, so a class means the
 * same thing wherever it appears: a verb is the red of Verbs, a connector the
 * amber of Linking clauses, an adjective and an adverb two shades of the green
 * of Adjectives & adverbs, and an article and a pronoun the purple and its
 * neighbour from Nouns & articles. A preposition gets its own rust, because it
 * is the thing that governs the noun phrase rather than part of it, and a
 * question word the teal of Sentence structure, because what it does here is
 * open a clause.
 *
 * **Thirteen is not thirteen at once.** `ExampleList` prints a legend naming
 * only the classes the topic on screen actually uses. Measured over the built
 * corpus, the most any single topic uses is six — the active/passive topic,
 * which needs the auxiliary and the participle as well as the noun phrase —
 * and half the topics use two or fewer. A learner never has to hold this whole
 * table in their head, and the colours are a shortcut for someone who has read
 * the legend once — never the only way to know what is marked.
 *
 * Every ink clears 4.5:1 against the wash behind it and against the card, so
 * the mark is readable before its colour means anything.
 *
 * A mark with no class renders in the neutral accent instead, and the legend
 * names that too. It means "this is the form the topic teaches", which is both
 * true and all the build knows when the class was not written — for a
 * correlative particle, or a bare noun phrase, where no class in this table
 * fits and a forced one would be a small lie.
 */
export interface RoleTone {
  readonly ink: string;
  readonly wash: string;
  readonly label: string;
}

export const roleTone: Readonly<Record<MarkRole, RoleTone>> = {
  verb: { ink: '#b3261e', wash: '#fbe9e7', label: 'verb' },
  conj: { ink: '#8a6100', wash: '#fdf1d6', label: 'connector' },
  prep: { ink: '#a2521a', wash: '#fceee2', label: 'preposition' },
  article: { ink: '#6b3fa0', wash: '#f1eafa', label: 'article' },
  pronoun: { ink: '#9c3f6d', wash: '#fbe9f2', label: 'pronoun' },
  adjective: { ink: '#1f7a4d', wash: '#e4f4ec', label: 'adjective' },
  q: { ink: '#1f6f8b', wash: '#e6f2f6', label: 'question word' },
  // Slate, not an eighth hue. The coloured classes are all function words —
  // what a word *does* in the clause — and the noun is the thing they do it to.
  // Reading as ink rather than as a signal is the right weight for it, and it
  // keeps a topic that marks both an article and a noun legible.
  noun: { ink: '#4a4a57', wash: '#eeeef2', label: 'noun' },

  // The verb, in pieces.
  //
  // `participle` and `prefix` deliberately share the verb's red. In
  // `hat gearbeitet` and `steht … auf` the two marks are two parts of one verb
  // form, and one hue is the true claim about them — giving the prefix its own
  // colour would say it is a different kind of thing, which is the
  // misunderstanding the topic exists to prevent.
  //
  // `aux` is set apart because the learner does have to tell them apart: the
  // auxiliary carries the person and tense and means nothing on its own, the
  // participle carries the meaning and never inflects. Same family, visibly not
  // the same job. Every ink here clears 4.5:1 on the card, the background and
  // its own wash — measured, lowest 5.42.
  aux: { ink: '#8a4b3c', wash: '#f7ebe7', label: 'auxiliary' },
  participle: { ink: '#b3261e', wash: '#fbe9e7', label: 'participle' },
  prefix: { ink: '#b3261e', wash: '#fbe9e7', label: 'separable prefix' },

  // Olive, not the adjective's green, though both are modifiers. The file's
  // rule is that a class takes its family's hue and shifts the shade only when
  // the learner has to tell two members apart — as with `aux` and `participle`.
  // Adjective against adverb is that case: the adjective declines and the
  // adverb never does, and German teaches them as the pair you must not
  // confuse. 6.18:1 on the card, 5.68 on the background, 5.43 on its own wash.
  adverb: { ink: '#55682a', wash: '#eef2e4', label: 'adverb' },

  // The verb's red again, for the same reason `participle` and `prefix` have
  // it: a changed stem is part of one verb form, not a different kind of thing.
  // It needs no hue of its own because it is always marked inside a word, which
  // already sets it apart — and beside it `ending` in teal makes the point the
  // stem-change topics exist for: the vowel moved, the ending did not.
  stem: { ink: '#b3261e', wash: '#fbe9e7', label: 'stem' },

  // Marked inside its word, so it is already distinct by construction; the
  // colour only has to not collide with the classes an ending topic also uses.
  ending: { ink: '#146b6b', wash: '#e3f1f1', label: 'ending' },
};
