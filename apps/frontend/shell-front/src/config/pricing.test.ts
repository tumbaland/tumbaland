import { describe, expect, it } from 'vitest';
import { CatalogPlan } from '@tumbaland/frontend-core';
import {
  PLAN_COPY,
  formatPrice,
  hasYearlyPricing,
  isHighlighted,
  limitLinesFor,
  priceFor,
  taglineFor,
  yearlySavingMonths
} from './pricing';

const GB = 1024 ** 3;

const limits = (overrides: Partial<{
  storageBytes: number;
  aiJobs: number;
  trackedTickers: number;
  seats: number;
  retentionDays: number;
  cleanExport: boolean;
}> = {}) => ({
  meters: {
    storageBytes: overrides.storageBytes ?? GB,
    aiJobs: overrides.aiJobs ?? 25,
    trackedTickers: overrides.trackedTickers ?? 3,
    seats: overrides.seats ?? 1
  },
  features: { cleanExport: overrides.cleanExport ?? false },
  retentionDays: overrides.retentionDays ?? 90
});

const plan = (overrides: Partial<CatalogPlan> = {}): CatalogPlan => ({
  code: 'support',
  name: 'Support',
  priceMonthlyCents: 500,
  priceYearlyCents: 5000,
  effectiveLimits: limits(),
  ...overrides
});

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
  it('returns the price for the chosen interval', () => {
    expect(priceFor(plan(), 'month')).toBe(500);
    expect(priceFor(plan(), 'year')).toBe(5000);
  });

  it('treats a missing yearly price as zero rather than NaN', () => {
    expect(priceFor(plan({ priceYearlyCents: undefined }), 'year')).toBe(0);
  });
});

describe('yearlySavingMonths', () => {
  it('is zero for a free plan rather than dividing by zero', () => {
    expect(yearlySavingMonths(plan({ priceMonthlyCents: 0, priceYearlyCents: 0 }))).toBe(0);
  });

  it('reports two months free when a year costs ten months', () => {
    expect(yearlySavingMonths(plan())).toBe(2);
  });
});

describe('hasYearlyPricing', () => {
  it('is false when nothing can be bought yearly, so no toggle is offered', () => {
    expect(hasYearlyPricing([plan({ priceYearlyCents: 0 })])).toBe(false);
  });

  it('is true as soon as one plan has a yearly price', () => {
    expect(hasYearlyPricing([plan({ priceYearlyCents: 0 }), plan()])).toBe(true);
  });
});

describe('copy', () => {
  it('uses the shipped tagline for a plan we wrote copy for', () => {
    expect(taglineFor(plan({ code: 'support' }))).toBe(PLAN_COPY.support.tagline);
  });

  it('falls back to the plan\'s own description, so an admin can add a plan without a deploy', () => {
    expect(taglineFor(plan({ code: 'studio', description: 'For a studio.' }))).toBe('For a studio.');
  });

  it('renders no tagline rather than inventing one', () => {
    expect(taglineFor(plan({ code: 'studio' }))).toBe('');
  });

  it('highlights free, and only free', () => {
    // The badge belongs on the tier everyone actually uses. On the paid card it
    // read as "the free column is the sample", which is the opposite of what
    // this section now says.
    const highlighted = ['free', 'support'].filter((code) => isHighlighted(plan({ code })));
    expect(highlighted).toEqual(['free']);
  });
});

describe('limitLinesFor', () => {
  it('derives every line from the limits the services enforce', () => {
    const lines = limitLinesFor(limits({ storageBytes: 50 * GB, trackedTickers: 25, retentionDays: -1 }));

    expect(lines.map((l) => l.text)).toEqual([
      '50 GB photos',
      'Full history',
      '25 tracked tickers',
      'Portfolio planner',
      '1 person'
    ]);
  });

  it('calls storage shared when the plan seats more than one person', () => {
    const lines = limitLinesFor(limits({ storageBytes: 250 * GB, seats: 5 }));

    expect(lines[0].text).toBe('250 GB shared photos');
    expect(lines.at(-1)!.text).toBe('Up to 5 people');
  });

  it('states the retention window for a plan that has one', () => {
    expect(limitLinesFor(limits({ retentionDays: 90 }))[1].text).toBe('90 days of history');
  });

  it('offers the planner only where retention does not clip it', () => {
    // Retention *is* the planner gate — the simulation needs roughly two years
    // of closes — so the line is derived from it rather than hardcoded.
    expect(limitLinesFor(limits({ retentionDays: 90 })).some((l) => l.key === 'planner')).toBe(false);
    expect(limitLinesFor(limits({ retentionDays: -1 })).some((l) => l.key === 'planner')).toBe(true);
  });

  it('renders sub-gigabyte storage in megabytes', () => {
    expect(limitLinesFor(limits({ storageBytes: 512 * 1024 ** 2 }))[0].text).toBe('512 MB photos');
  });

  it('says unlimited rather than printing -1', () => {
    const lines = limitLinesFor(limits({ storageBytes: -1, trackedTickers: -1, seats: -1 }));

    // Unlimited seats also makes the storage pooled, which is the staff plan.
    expect(lines.map((l) => l.text)).toContain('Unlimited shared photos');
    expect(lines.map((l) => l.text)).toContain('Unlimited tracked tickers');
    expect(lines.map((l) => l.text)).toContain('Unlimited people');
  });

  it('advertises neither AI analysis nor clean export, because nothing enforces them', () => {
    // MONETIZATION.md 3.0 and 3.1: the browser calls the AI services directly
    // and no watermarking code exists, so a number on the card would be a claim
    // the product cannot hold itself to.
    const keys = limitLinesFor(limits({ aiJobs: 600, cleanExport: true })).map((l) => l.key);

    expect(keys).not.toContain('ai');
    expect(keys).not.toContain('export');
  });

  it('uses unique line keys', () => {
    const keys = limitLinesFor(limits({ retentionDays: -1 })).map((l) => l.key);
    expect(new Set(keys).size).toBe(keys.length);
  });

  it('never renders a dash, which would read as a missing feature', () => {
    limitLinesFor(limits()).forEach((line) => {
      expect(line.text).not.toMatch(/^[—–-]$/);
      expect(line.text).toBeTruthy();
    });
  });
});
