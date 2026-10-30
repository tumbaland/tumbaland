import { MODELS, MODEL_IDS, UNITS_PER_DOLLAR, costUnits, isModelId, modelCatalog } from './assistantModels';

const none = { input: 0, output: 0, cacheRead: 0, cacheWrite: 0 };

describe('costUnits', () => {
  it('prices input and output per million tokens, in ten-thousandths of a dollar', () => {
    // One million tokens in and out on Sonnet: $2 + $10.
    expect(costUnits('claude-sonnet-5-5', { ...none, input: 1_000_000, output: 1_000_000 })).toBe(12 * UNITS_PER_DOLLAR);
  });

  it('charges a quarter more to write the prompt cache and a tenth to read it', () => {
    expect(costUnits('claude-opus-5-5', { ...none, cacheWrite: 1_000_000 })).toBe(5 * UNITS_PER_DOLLAR);
    expect(costUnits('claude-opus-5-5', { ...none, cacheRead: 1_000_000 })).toBe(0.4 * UNITS_PER_DOLLAR);
  });

  it('counts the cheapest reply as one unit and not as nothing', () => {
    expect(costUnits('claude-haiku-5-5', { ...none, input: 10, output: 5 })).toBe(1);
    expect(costUnits('claude-haiku-5-5', none)).toBe(1);
  });

  it('puts a typical reply in the order of magnitude the plan was written for', () => {
    const reply = { input: 15_000, output: 1_000, cacheRead: 0, cacheWrite: 0 };
    // Roughly 20 / 400 / 800: Haiku is cents, Opus is a few cents.
    expect(costUnits('claude-haiku-5-5', reply)).toBeLessThan(40);
    expect(costUnits('claude-sonnet-5-5', reply)).toBeGreaterThan(costUnits('claude-haiku-5-5', reply) * 10);
    expect(costUnits('claude-opus-5-5', reply)).toBeGreaterThan(costUnits('claude-sonnet-5-5', reply));
  });
});

describe('the model table', () => {
  it('has an entry for every id, each labelled and priced', () => {
    for (const id of MODEL_IDS) {
      expect(MODELS[id].id).toBe(id);
      expect(MODELS[id].inputPerMTok).toBeGreaterThan(0);
      expect(MODELS[id].outputPerMTok).toBeGreaterThan(MODELS[id].inputPerMTok);
    }
  });

  it('knows which model cannot be retried on another when it declines', () => {
    expect(MODELS['claude-haiku-5-5'].fallbacks).toBe(false);
    expect(MODELS['claude-opus-5-5'].fallbacks).toBe(true);
  });

  it('recognises only its own ids', () => {
    expect(isModelId('claude-sonnet-5-5')).toBe(true);
    expect(isModelId('gpt-5')).toBe(false);
    expect(isModelId(undefined)).toBe(false);
  });

  it('shows people a label and never request settings', () => {
    const catalog = modelCatalog();
    expect(catalog.map((entry) => entry.label)).toEqual(['Fast', 'Balanced', 'Best']);
    expect(catalog[0]).not.toHaveProperty('effort');
    expect(catalog[0]).not.toHaveProperty('fallbacks');
  });
});
