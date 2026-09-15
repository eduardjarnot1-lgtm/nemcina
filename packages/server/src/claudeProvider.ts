/**
 * The coach's language model.
 *
 * Kept in its own file behind `CoachProvider` for two reasons. The obvious one
 * is that a different provider should be a different file. The less obvious one
 * is that this is the server's only runtime dependency — everything else runs on
 * `node:*` alone — and confining it to one import makes that visible rather than
 * something you discover in a lockfile.
 */

import Anthropic from '@anthropic-ai/sdk';
import { ProviderError, type CoachProvider } from './coach.ts';

export interface ClaudeProviderOptions {
  readonly apiKey: string;
  readonly model: string;
  /** Short by design: the coach says two or three sentences. */
  readonly maxTokens?: number;
}

/**
 * Claude, through the official SDK.
 *
 * `effort: 'low'` because this is a short phrasing task over facts that are
 * already computed — the model is not being asked to work anything out, and
 * paying for depth it cannot use is paying for nothing. Adaptive thinking is on
 * by default on this model and is left alone.
 *
 * Refusal fallbacks are enabled: a policy decline would otherwise end the
 * request with no text at all, and the learner would see a failure for asking
 * about their vocabulary. It costs nothing when nothing is declined.
 */
export function claudeProvider(options: ClaudeProviderOptions): CoachProvider {
  const client = new Anthropic({ apiKey: options.apiKey });
  const model = options.model;
  const maxTokens = options.maxTokens ?? 512;

  return {
    name: `claude:${model}`,
    async respond(system: string, user: string): Promise<string> {
      let response: Anthropic.Beta.Messages.BetaMessage;
      try {
        response = await client.beta.messages.create({
          model,
          max_tokens: maxTokens,
          system,
          output_config: { effort: 'low' },
          betas: ['server-side-fallback-2026-07-01'],
          fallbacks: 'default',
          messages: [{ role: 'user', content: user }],
        });
      } catch (error) {
        // Typed classes, most specific first: the difference between "try again"
        // and "this will never work" is the whole value of catching at all.
        if (error instanceof Anthropic.AuthenticationError) {
          throw new ProviderError('the coach is misconfigured');
        }
        if (error instanceof Anthropic.RateLimitError) {
          throw new ProviderError('the coach is busy; try again shortly');
        }
        if (error instanceof Anthropic.APIError) {
          throw new ProviderError(`the coach could not answer (${error.status})`);
        }
        throw new ProviderError('the coach could not be reached');
      }

      // A refusal is an HTTP 200 with no usable text. Check before reading.
      if (response.stop_reason === 'refusal') {
        throw new ProviderError('the coach declined to answer that');
      }

      const text = response.content
        .filter((block): block is Anthropic.Beta.Messages.BetaTextBlock => block.type === 'text')
        .map((block) => block.text)
        .join('')
        .trim();

      if (!text) throw new ProviderError('the coach returned nothing');
      return text;
    },
  };
}
