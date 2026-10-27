import { describe, expect, it } from 'vite-plus/test';
import {
  ago,
  countryName,
  formatAmount,
  formatBytes,
  formatCount,
  formatDate,
  formatDateTime,
  formatDay,
  formatLimit,
  formatPercent,
  formatShortDay,
  moduleLabel,
  platformLabel,
  serviceLabel
} from './format';

describe('numbers', () => {
  it('groups digits', () => {
    expect(formatCount(1234567)).toBe(new Intl.NumberFormat().format(1234567));
  });

  it('writes a share as a whole percent', () => {
    expect(formatPercent(1 / 3)).toBe('33%');
    expect(formatPercent(0)).toBe('0%');
    expect(formatPercent(1)).toBe('100%');
  });

  it.each([
    [0, '0 B'],
    [1023, '1023 B'],
    [1024, '1 KB'],
    [1536, '1.5 KB'],
    [5 * 1024 ** 2, '5 MB'],
    [250 * 1024 ** 2, '250 MB'],
    [1024 ** 3, '1 GB'],
    [50 * 1024 ** 3, '50 GB'],
    [3 * 1024 ** 4, '3 TB'],
    [5000 * 1024 ** 4, '5000 TB']
  ])('writes %d bytes as %s', (bytes, expected) => {
    expect(formatBytes(bytes)).toBe(expected);
  });

  it('says no limit for the plan’s -1', () => {
    expect(formatLimit(-1, 'bytes')).toBe('No limit');
    expect(formatLimit(-1, 'count')).toBe('No limit');
    expect(formatLimit(1024 ** 3, 'bytes')).toBe('1 GB');
    expect(formatLimit(25, 'count')).toBe('25');
  });

  it('formats an amount in its own unit', () => {
    expect(formatAmount(2048, 'bytes')).toBe('2 KB');
    expect(formatAmount(2048, 'count')).toBe(formatCount(2048));
  });
});

describe('dates', () => {
  it('writes a UTC day the same wherever the browser is', () => {
    // The weekday is there for one and not the other; the wording is the browser's.
    expect(formatDay('2026-10-27')).toMatch(/27/);
    expect(formatDay('2026-10-27').length).toBeGreaterThan(formatShortDay('2026-10-27').length);
    expect(formatShortDay('2026-10-27')).toMatch(/27/);
  });

  it('says never for nothing', () => {
    expect(formatDate(null)).toBe('Never');
    expect(formatDate(undefined)).toBe('Never');
    expect(formatDateTime(null)).toBe('Never');
    expect(ago(null)).toBe('Never');
  });

  it('writes a date and a time', () => {
    expect(formatDate('2026-10-27T10:00:00Z')).toMatch(/2026/);
    expect(formatDateTime('2026-10-27T10:00:00Z')).toMatch(/2026/);
  });

  describe('ago', () => {
    const now = new Date('2026-10-27T12:00:00Z');

    it.each([
      ['2026-10-27T01:00:00Z', 'Today'],
      ['2026-10-26T11:00:00Z', 'Yesterday'],
      ['2026-10-22T12:00:00Z', '5 days ago'],
      ['2026-08-27T12:00:00Z', '2 months ago'],
      ['2024-10-27T12:00:00Z', '2 years ago'],
      ['2026-10-28T12:00:00Z', 'Today']
    ])('reads %s as %s', (when, expected) => {
      expect(ago(when, now)).toBe(expected);
    });
  });
});

describe('names', () => {
  it('uses the names a person knows, not the routes and services', () => {
    expect(moduleLabel('relationship')).toBe('Journal');
    expect(moduleLabel('finance')).toBe('Money');
    expect(moduleLabel('payments')).toBe('Billing');
    expect(moduleLabel('something-new')).toBe('something-new');
    expect(serviceLabel('relationship-service')).toBe('Journal');
    expect(serviceLabel('mcp-service')).toBe('Assistant tools');
    expect(serviceLabel('brand-new-service')).toBe('brand-new');
    expect(platformLabel('pwa')).toBe('Installed app');
    expect(platformLabel('toaster')).toBe('toaster');
  });

  it('names a country, and falls back to its code', () => {
    expect(countryName(null)).toBeNull();
    expect(countryName('EE')).toMatch(/Estonia/);
    expect(countryName('not a code!')).toBe('not a code!');
  });
});
