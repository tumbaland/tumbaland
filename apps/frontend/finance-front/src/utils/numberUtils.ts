/**
 * Utility functions for parsing and formatting numbers
 */

/**
 * Parses user numeric input accepting both dot (12.5) and comma (12,5) decimal
 * separators, including European thousands+decimal format: 12.504,00 → 12504.00
 * @returns The parsed number, or NaN if empty/invalid
 */
export function parseNumericInput(value: string): number {
  const s = value.trim();
  if (!s) return NaN;
  if (s.includes(',') && s.includes('.')) {
    return parseFloat(s.replace(/\./g, '').replace(',', '.'));
  }
  if (s.includes(',')) {
    return parseFloat(s.replace(/ /g, '').replace(',', '.'));
  }
  return parseFloat(s.replace(/ /g, ''));
}

/**
 * Formats an amount in the given ISO currency without decimals, e.g. 12 504 €.
 * The currency must be passed for anything that is not in the base currency —
 * instrument prices arrive in the instrument's own currency, and labelling a
 * dollar amount with a euro sign is how mixed-currency totals go unnoticed.
 */
export function formatCurrency(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('et-EE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 0,
    maximumFractionDigits: 0
  }).format(value);
}

/** Like {@link formatCurrency} but keeping decimals, for per-share prices. */
export function formatPrice(value: number, currency: string = 'EUR'): string {
  return new Intl.NumberFormat('et-EE', {
    style: 'currency',
    currency,
    minimumFractionDigits: 2,
    maximumFractionDigits: 3
  }).format(value);
}

/** Formats a signed percentage with one decimal, e.g. +4.2% */
export function formatPct(value: number): string {
  const sign = value > 0 ? '+' : '';
  return `${sign}${value.toFixed(1)}%`;
}

/**
 * Parses a number string that may contain commas as thousand separators
 * @param value - The string value to parse
 * @returns The parsed number, or NaN if invalid
 */
export function parseNumberWithCommas(value: string | number): number {
  if (typeof value === 'number') {
    return value;
  }

  if (!value || typeof value !== 'string') {
    return NaN;
  }

  // Remove commas and parse
  const cleaned = value.toString().replace(/,/g, '');
  const parsed = parseFloat(cleaned);

  return isNaN(parsed) ? NaN : parsed;
}

/**
 * Formats a number with commas as thousand separators
 * @param value - The number to format
 * @param decimals - Number of decimal places (default: 2)
 * @returns The formatted string
 */
export function formatNumberWithCommas(value: number | string, decimals: number = 2): string {
  const num = typeof value === 'string' ? parseFloat(value) : value;

  if (isNaN(num)) {
    return '0';
  }

  return num.toLocaleString('en-US', {
    minimumFractionDigits: decimals,
    maximumFractionDigits: decimals,
  });
}