import { describe, expect, it } from 'vitest';
import { ink } from '@tumbaland/frontend-core';
import { CHAT_THEMES } from './themes';

/** WCAG contrast ratio between two #rrggbb colours. */
function contrast(a: string, b: string): number {
  const luminance = (hex: string) => {
    const [r, g, bl] = [1, 3, 5].map((i) => parseInt(hex.slice(i, i + 2), 16) / 255);
    const linear = (c: number) => (c <= 0.03928 ? c / 12.92 : ((c + 0.055) / 1.055) ** 2.4);
    return 0.2126 * linear(r!) + 0.7152 * linear(g!) + 0.0722 * linear(bl!);
  };
  const [high, low] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (high! + 0.05) / (low! + 0.05);
}

/** AA for normal-size text, which is what bubbles and the header's status line are. */
const AA = 4.5;

describe.each(CHAT_THEMES)('the $name theme', (theme) => {
  it('keeps white text readable on its bubbles', () => {
    expect(contrast(theme.bubble, '#ffffff')).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the header’s status line and "typing…" readable on its tint', () => {
    expect(contrast(ink.body, theme.header)).toBeGreaterThanOrEqual(AA);
    expect(contrast(theme.headerAccent, theme.header)).toBeGreaterThanOrEqual(AA);
  });
});
