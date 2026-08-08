import { describe, expect, it } from 'vitest';
import { LIMIT_ROWS, PLANS, PlanCode, formatPrice, priceFor, yearlySavingMonths } from './pricing';

const CODES: PlanCode[] = ['free', 'personal', 'family'];

describe('formatPrice', () => {
  it('renders free as €0 without decimals', () => {
    expect(formatPrice(0)).toBe('€0');
  });

  it('converts cents to whole euros', () => {
    expect(formatPrice(600)).toBe('€6');
    expect(formatPrice(12000)).toBe('€120');
  });
});

describe('priceFor', () => {
  const personal = PLANS.find((p) => p.code === 'personal')!;

  it('returns the monthly price for a monthly interval', () => {
    expect(priceFor(personal, 'month')).toBe(personal.priceMonthlyCents);
  });

  it('returns the yearly price for a yearly interval', () => {
    expect(priceFor(personal, 'year')).toBe(personal.priceYearlyCents);
  });
});

describe('yearlySavingMonths', () => {
  it('is zero for the free plan rather than dividing by zero', () => {
    const free = PLANS.find((p) => p.code === 'free')!;
    expect(yearlySavingMonths(free)).toBe(0);
  });

  it('reports two months free when a year costs ten months', () => {
    const personal = PLANS.find((p) => p.code === 'personal')!;
    expect(yearlySavingMonths(personal)).toBe(2);
  });
});

describe('plan and limit definitions', () => {
  it('defines exactly the three plan codes the backend will key limits by', () => {
    expect(PLANS.map((p) => p.code)).toEqual(CODES);
  });

  it('marks exactly one plan as the highlighted default', () => {
    expect(PLANS.filter((p) => p.highlight)).toHaveLength(1);
  });

  it('prices a year below twelve months for every paid plan', () => {
    PLANS.filter((p) => p.priceMonthlyCents > 0).forEach((plan) => {
      expect(plan.priceYearlyCents).toBeLessThan(plan.priceMonthlyCents * 12);
    });
  });

  it('always gives the paid plans a value, so a tier can never look empty', () => {
    LIMIT_ROWS.forEach((row) => {
      expect(row.values.personal).toBeTruthy();
      expect(row.values.family).toBeTruthy();
    });
  });

  it('phrases every value as something the tier has, never as a dash', () => {
    LIMIT_ROWS.forEach((row) => {
      CODES.forEach((code) => {
        const value = row.values[code];
        // null omits the line entirely; a dash would render as a visible gap.
        expect(value === null || !/^[—–-]$/.test(value)).toBe(true);
      });
    });
  });

  it('leaves the free tier a usable list rather than a wall of omissions', () => {
    const freeLines = LIMIT_ROWS.filter((row) => row.values.free).length;
    expect(freeLines).toBeGreaterThanOrEqual(LIMIT_ROWS.length - 1);
  });

  it('uses unique row keys', () => {
    const keys = LIMIT_ROWS.map((r) => r.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('flags AI analysis as not yet enforceable (MONETIZATION.md §3.1)', () => {
    const ai = LIMIT_ROWS.find((r) => r.key === 'ai');
    expect(ai?.comingSoon).toBe(true);
  });
});
