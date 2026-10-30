/**
 * The Claude models a chat assistant can run on, in one table.
 *
 * Haiku, Sonnet and Opus differ in more than price: whether a refused request
 * can be retried on another model, and how much thinking they do by default,
 * are per model. Everything that depends on which model it is lives here, so
 * adding a fourth is one entry and the places that call Claude never ask "is
 * this Opus".
 *
 * Prices are Anthropic's list prices, dollars per million tokens, as of
 * 2026-10. They only feed the cost estimate behind the monthly allowance. The
 * Anthropic bill is the truth; admin compares the two once a month.
 */

export const MODEL_IDS = ['claude-haiku-5-5', 'claude-sonnet-5-5', 'claude-opus-5-5'] as const;
export type ModelId = (typeof MODEL_IDS)[number];

export const isModelId = (value: unknown): value is ModelId =>
  typeof value === 'string' && (MODEL_IDS as readonly string[]).includes(value);

export interface ModelSpec {
  id: ModelId;
  /** What people see. The model's name means nothing to them. */
  label: 'Fast' | 'Balanced' | 'Best';
  /** What admin sees. */
  name: 'Haiku' | 'Sonnet' | 'Opus';
  /** One line on the bot editor, about the one thing they will feel: the allowance. */
  hint: string;
  /** Dollars per million input tokens. */
  inputPerMTok: number;
  /** Dollars per million output tokens. */
  outputPerMTok: number;
  /**
   * Whether a request Anthropic's safety classifiers decline can be re-run on a
   * substitute model by the server. Haiku 5.5 has no such fallback.
   */
  fallbacks: boolean;
  /** Thinking depth. The defaults differ per model, so it is set rather than left. */
  effort: 'low' | 'medium' | 'high';
  /**
   * The web tools this model can use. The 2026-02-09 versions filter what a page
   * says before the model reads it, which saves tokens, but are documented only for
   * Sonnet and Opus; Haiku gets the basic versions.
   */
  webTools: { search: string; fetch: string };
}

const FILTERED_WEB = { search: 'web_search_20260209', fetch: 'web_fetch_20260209' };
const BASIC_WEB = { search: 'web_search_20250305', fetch: 'web_fetch_20250910' };

export const MODELS: Readonly<Record<ModelId, ModelSpec>> = {
  'claude-haiku-5-5': {
    id: 'claude-haiku-5-5',
    label: 'Fast',
    name: 'Haiku',
    hint: 'Quick and light on your allowance. Can stumble when a request takes several steps.',
    inputPerMTok: 0.1,
    outputPerMTok: 0.5,
    fallbacks: false,
    effort: 'medium',
    webTools: BASIC_WEB
  },
  'claude-sonnet-5-5': {
    id: 'claude-sonnet-5-5',
    label: 'Balanced',
    name: 'Sonnet',
    hint: 'Good at multi-step requests like making a collage. Uses a moderate share of your allowance.',
    inputPerMTok: 2,
    outputPerMTok: 10,
    fallbacks: true,
    effort: 'medium',
    webTools: FILTERED_WEB
  },
  'claude-opus-5-5': {
    id: 'claude-opus-5-5',
    label: 'Best',
    name: 'Opus',
    hint: 'The most careful and the most thoughtful. Uses the most of your allowance.',
    inputPerMTok: 4,
    outputPerMTok: 20,
    fallbacks: true,
    effort: 'medium',
    webTools: FILTERED_WEB
  }
};

/** Writing to the prompt cache costs a quarter more than reading input; reading it back costs a tenth. */
const CACHE_WRITE_FACTOR = 1.25;
const CACHE_READ_FACTOR = 0.1;

/**
 * One unit of the `assistantSpend` meter: a ten-thousandth of a dollar. A Haiku
 * reply is around 20 of them, an Opus reply with a collage around 1000. Whole
 * units, because a meter is an integer, and fine enough that the cheapest
 * reply does not round to nothing.
 */
export const UNITS_PER_DOLLAR = 10_000;

/**
 * Anthropic bills a web search on its own, a cent each, on top of the tokens of
 * the pages it brings back. List price as of 2026-10: check it against the bill.
 */
export const WEB_SEARCH_DOLLARS = 0.01;

export interface TokenUsage {
  input: number;
  output: number;
  cacheRead: number;
  cacheWrite: number;
  /** Searches the model ran. Left out where none could. */
  webSearches?: number;
}

/** What a reply cost, in meter units, never less than one: every reply is counted. */
export function costUnits(model: ModelId, usage: TokenUsage): number {
  const spec = MODELS[model];
  const dollars =
    (usage.input * spec.inputPerMTok +
      usage.cacheWrite * spec.inputPerMTok * CACHE_WRITE_FACTOR +
      usage.cacheRead * spec.inputPerMTok * CACHE_READ_FACTOR +
      usage.output * spec.outputPerMTok) /
      1_000_000 +
    (usage.webSearches ?? 0) * WEB_SEARCH_DOLLARS;
  return Math.max(1, Math.ceil(dollars * UNITS_PER_DOLLAR));
}

/** The models as admin and the bot editor see them: no request settings. */
export const modelCatalog = (): Array<Pick<ModelSpec, 'id' | 'label' | 'name' | 'hint' | 'inputPerMTok' | 'outputPerMTok'>> =>
  MODEL_IDS.map((id) => {
    const { label, name, hint, inputPerMTok, outputPerMTok } = MODELS[id];
    return { id, label, name, hint, inputPerMTok, outputPerMTok };
  });
