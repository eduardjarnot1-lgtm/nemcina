/**
 * What shape is this piece of grammar content?
 *
 * The grammar corpus is prose: a topic carries a summary, headed explanation
 * sections, a list of rule sentences, and examples with a short annotation.
 * None of it is tagged, so a screen rendering it cannot tell a warning from an
 * ordinary rule, and every line ends up looking the same — which is exactly why
 * the topic pages read as a wall of text.
 *
 * This reads only the marks the corpus actually carries.
 *
 * **What is marked.** 14 rules open with "Achtung:". That is the emphasis of
 * the people who wrote the grammar, written into the text, and promoting those
 * to a warning is presenting their emphasis rather than inventing one.
 *
 * **What is not, and is therefore not attempted.** 91 rules contain "→", and a
 * component showing "arbeiten → du arbeitest" as two sides was written and then
 * removed: the notation is not consistent enough to split safely. The arrow
 * appears mid-sentence ("So the only difference is masculine der → den"), rules
 * stack two colons before it, and the forms after the first change are often a
 * list that a naive split drops. A transformation rendered with the wrong
 * halves teaches the wrong form, and a parser that silently loses "er arbeitet,
 * ihr arbeitet" is worse than a paragraph. They stay paragraphs.
 *
 * Nothing here infers a "common mistake", an "exception" or a comparison
 * between two structures either. The corpus does not mark them, and guessing
 * would put invented grammar on the page.
 */

export type RuleShape =
  /** Opens with the corpus's own "Achtung:" — the authors' emphasis, kept. */
  | { readonly kind: 'warning'; readonly text: string }
  /** Everything else. */
  | { readonly kind: 'plain'; readonly text: string };

const WARNING = /^\s*achtung\s*[:!]\s*/i;

/** Classify one rule sentence. Never throws, and never loses its text. */
export function ruleShape(rule: string): RuleShape {
  const text = rule.trim();
  if (WARNING.test(text)) {
    const body = text.replace(WARNING, '').trim();
    // A marker with nothing after it is not a warning, it is a stray label.
    if (body) return { kind: 'warning', text: body };
  }
  return { kind: 'plain', text };
}

/**
 * The broad grammatical family a topic belongs to.
 *
 * The corpus states a `category` per topic — twenty of them, in German. They
 * collapse into six families, and the point of collapsing them is that the same
 * kind of grammar can then look the same everywhere in the app: a topic about
 * the Dativ and a topic about articles are both about the noun phrase, and
 * reading them should feel like reading the same kind of thing.
 *
 * Colour follows this and nothing else, so it carries meaning rather than
 * decorating the screen. An unrecognised category is `other`, which is a real
 * family with a real colour, not an error.
 */
export type GrammarFamily =
  | 'verb' | 'nounPhrase' | 'sentence' | 'connector' | 'modifier' | 'other';

const FAMILIES: Readonly<Record<string, GrammarFamily>> = {
  'Verben': 'verb',
  'Modalverben': 'verb',
  'Passiv': 'verb',
  'Indirekte Rede': 'verb',
  'Nomen': 'nounPhrase',
  'Artikel und Pronomen': 'nounPhrase',
  'Pronomen': 'nounPhrase',
  'Deklination': 'nounPhrase',
  'Satzstrukturen': 'sentence',
  'Satzstellung': 'sentence',
  'Textgrammatik': 'sentence',
  'Satzverbindungen': 'connector',
  'Konnektoren': 'connector',
  'Adjektive': 'modifier',
  'Komparation': 'modifier',
  'Adverbien und Präpositionen': 'modifier',
  'Präpositionen': 'modifier',
};

export const grammarFamily = (category: string): GrammarFamily =>
  FAMILIES[category] ?? 'other';
