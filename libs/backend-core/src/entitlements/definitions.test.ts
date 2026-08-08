import {
  DEFAULT_PLAN_LIMITS,
  FALLBACK_PLAN,
  FEATURE_KEYS,
  METER_KEYS,
  STAFF_PLAN,
  UNLIMITED,
  applyLimits,
  fitsWithin,
  isFeatureKey,
  isMeterKey,
  meterPeriod,
  normalizeLimits,
  resolveLimits
} from './definitions';

describe('resolveLimits', () => {
  it('returns the defaults for a known plan code', () => {
    expect(resolveLimits('personal')).toEqual(DEFAULT_PLAN_LIMITS.personal);
  });

  it('falls back to free for an unknown code, never to unlimited', () => {
    expect(resolveLimits('enterprise-typo')).toEqual(DEFAULT_PLAN_LIMITS.free);
    expect(resolveLimits(undefined)).toEqual(DEFAULT_PLAN_LIMITS[FALLBACK_PLAN]);
  });

  it('returns a copy, so a caller mutating limits cannot poison the defaults', () => {
    const limits = resolveLimits('free');
    limits.meters.storageBytes = 999;
    limits.features.cleanExport = true;

    expect(resolveLimits('free').meters.storageBytes).toBe(DEFAULT_PLAN_LIMITS.free.meters.storageBytes);
    expect(resolveLimits('free').features.cleanExport).toBe(false);
  });
});

describe('normalizeLimits', () => {
  it('applies stored values over the plan defaults', () => {
    const limits = normalizeLimits({ meters: { storageBytes: 123 }, retentionDays: 30 }, 'personal');

    expect(limits.meters.storageBytes).toBe(123);
    expect(limits.retentionDays).toBe(30);
    // Untouched keys keep the plan's defaults rather than resetting to free.
    expect(limits.meters.trackedTickers).toBe(DEFAULT_PLAN_LIMITS.personal.meters.trackedTickers);
  });

  it('drops keys that no code enforces', () => {
    const limits = normalizeLimits(
      { meters: { storageBytes: 5, wormholes: 1000 }, features: { cleanExport: true, teleport: true } },
      'free'
    );

    expect(limits.meters).not.toHaveProperty('wormholes');
    expect(limits.features).not.toHaveProperty('teleport');
    expect(Object.keys(limits.meters).sort()).toEqual([...METER_KEYS].sort());
  });

  it('normalizes any negative ceiling to UNLIMITED and floors fractions', () => {
    const limits = normalizeLimits({ meters: { aiJobs: -5, trackedTickers: 7.9 }, retentionDays: -2 }, 'free');

    expect(limits.meters.aiJobs).toBe(UNLIMITED);
    expect(limits.meters.trackedTickers).toBe(7);
    expect(limits.retentionDays).toBe(UNLIMITED);
  });

  it('ignores non-numeric and non-boolean junk instead of producing NaN limits', () => {
    const limits = normalizeLimits(
      { meters: { seats: 'lots' as unknown as number }, features: { cleanExport: 'yes' as unknown as boolean } },
      'family'
    );

    expect(limits.meters.seats).toBe(DEFAULT_PLAN_LIMITS.family.meters.seats);
    expect(limits.features.cleanExport).toBe(true);
  });

  it('returns the plan defaults for an empty or missing payload', () => {
    expect(normalizeLimits(undefined, 'family')).toEqual(DEFAULT_PLAN_LIMITS.family);
    expect(normalizeLimits(null, 'family')).toEqual(DEFAULT_PLAN_LIMITS.family);
    expect(normalizeLimits({}, 'family')).toEqual(DEFAULT_PLAN_LIMITS.family);
  });

  it('resolves an unknown plan code to free even when limits are stored', () => {
    const limits = normalizeLimits({ meters: { seats: 3 } }, 'gold-tier-that-never-shipped');

    expect(limits.meters.seats).toBe(3);
    expect(limits.meters.storageBytes).toBe(DEFAULT_PLAN_LIMITS.free.meters.storageBytes);
    expect(limits.features.cleanExport).toBe(false);
  });
});

describe('applyLimits', () => {
  it('layers a partial set over a complete one without mutating the base', () => {
    const base = resolveLimits('free');

    const layered = applyLimits(base, { meters: { storageBytes: 500 } });

    expect(layered.meters.storageBytes).toBe(500);
    expect(base.meters.storageBytes).toBe(DEFAULT_PLAN_LIMITS.free.meters.storageBytes);
  });

  it('stacks: defaults, then plan, then a per-user override', () => {
    const planLimits = normalizeLimits({ meters: { storageBytes: 100, seats: 2 } }, 'free');

    const withOverride = applyLimits(planLimits, { meters: { storageBytes: 5000 }, features: { cleanExport: true } });

    expect(withOverride.meters.storageBytes).toBe(5000); // override wins
    expect(withOverride.meters.seats).toBe(2); // plan wins where the override is silent
    expect(withOverride.meters.aiJobs).toBe(DEFAULT_PLAN_LIMITS.free.meters.aiJobs); // default underneath both
    expect(withOverride.features.cleanExport).toBe(true);
  });
});

describe('the staff plan', () => {
  it('grants every meter and feature without limit', () => {
    const limits = resolveLimits(STAFF_PLAN);

    for (const meter of METER_KEYS) {
      expect(limits.meters[meter]).toBe(UNLIMITED);
    }
    expect(limits.retentionDays).toBe(UNLIMITED);
    expect(limits.features.cleanExport).toBe(true);
  });
});

describe('fitsWithin', () => {
  it('treats UNLIMITED as always fitting', () => {
    expect(fitsWithin(UNLIMITED, Number.MAX_SAFE_INTEGER, 1)).toBe(true);
  });

  it('allows landing exactly on the limit but not passing it', () => {
    expect(fitsWithin(10, 9, 1)).toBe(true);
    expect(fitsWithin(10, 10, 1)).toBe(false);
  });
});

describe('key registry', () => {
  it('recognizes only registered keys', () => {
    expect(isMeterKey('storageBytes')).toBe(true);
    expect(isMeterKey('storagebytes')).toBe(false);
    expect(isFeatureKey('cleanExport')).toBe(true);
    expect(isFeatureKey('planner')).toBe(false);
  });

  it('assigns every meter a period', () => {
    expect(meterPeriod('aiJobs')).toBe('MONTH');
    expect(meterPeriod('storageBytes')).toBe('ALL');
  });

  it('gives every registered plan a value for every registered key', () => {
    for (const [code, limits] of Object.entries(DEFAULT_PLAN_LIMITS)) {
      for (const meter of METER_KEYS) {
        expect(typeof limits.meters[meter]).toBe(`number`);
      }
      for (const feature of FEATURE_KEYS) {
        expect(typeof limits.features[feature]).toBe('boolean');
      }
      expect(typeof limits.retentionDays).toBe(`number`);
      expect(code).toBeTruthy();
    }
  });
});
