/**
 * Utility functions for parsing and formatting numbers
 */

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