import {
  parseNumericInput,
  parseNumberWithCommas,
  formatCurrency,
  formatPct,
  formatNumberWithCommas
} from './numberUtils';

describe('formatCurrency', () => {
  it('formats a value as EUR with no decimals', () => {
    expect(formatCurrency(12504)).toBe('12 504 €');
  });
});

describe('parseNumericInput', () => {
  it('parses a plain dot decimal', () => {
    expect(parseNumericInput('12.5')).toBe(12.5);
  });

  it('parses a comma decimal', () => {
    expect(parseNumericInput('12,5')).toBe(12.5);
  });

  it('parses European thousands+decimal (dots grouping, comma decimal)', () => {
    expect(parseNumericInput('12.504,00')).toBe(12504);
    expect(parseNumericInput('1.234.567,89')).toBeCloseTo(1234567.89, 2);
  });

  it('strips spaces used as grouping separators', () => {
    expect(parseNumericInput('1 234')).toBe(1234);
    expect(parseNumericInput('1 234,5')).toBe(1234.5);
  });

  it('returns NaN for empty input', () => {
    expect(parseNumericInput('')).toBeNaN();
    expect(parseNumericInput('   ')).toBeNaN();
  });
});

describe('parseNumberWithCommas', () => {
  it('passes numbers through unchanged', () => {
    expect(parseNumberWithCommas(42)).toBe(42);
  });

  it('strips comma thousands separators', () => {
    expect(parseNumberWithCommas('1,234,567')).toBe(1234567);
  });

  it('returns NaN for empty or invalid input', () => {
    expect(parseNumberWithCommas('')).toBeNaN();
    expect(parseNumberWithCommas('abc')).toBeNaN();
  });
});

describe('formatPct', () => {
  it('prefixes a positive value with +', () => {
    expect(formatPct(4.2)).toBe('+4.2%');
  });

  it('keeps the minus sign for negatives without adding +', () => {
    expect(formatPct(-3.1)).toBe('-3.1%');
  });

  it('does not prefix zero', () => {
    expect(formatPct(0)).toBe('0.0%');
  });
});

describe('formatNumberWithCommas', () => {
  it('formats with grouping and default 2 decimals', () => {
    expect(formatNumberWithCommas(1234567.5)).toBe('1,234,567.50');
  });

  it('respects a custom decimal count', () => {
    expect(formatNumberWithCommas(1000, 0)).toBe('1,000');
  });

  it('returns "0" for non-numeric input', () => {
    expect(formatNumberWithCommas('not-a-number')).toBe('0');
  });
});
