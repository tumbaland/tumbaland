import { describe, expect, it } from 'vite-plus/test';
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { schemes } from '@tumbaland/frontend-core';
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

const variants = CHAT_THEMES.flatMap((theme) =>
  (['light', 'dark'] as const).map((scheme) => ({
    label: `${theme.name} (${scheme})`,
    variant: theme[scheme],
    ink: schemes[scheme].ink
  }))
);

describe.each(variants)('the $label theme', ({ variant, ink }) => {
  it('keeps white text readable on its bubbles', () => {
    expect(contrast(variant.bubble, '#ffffff')).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the header’s status line and "typing…" readable on its tint', () => {
    expect(contrast(ink.body, variant.header)).toBeGreaterThanOrEqual(AA);
    expect(contrast(variant.headerAccent, variant.header)).toBeGreaterThanOrEqual(AA);
  });

  it('keeps the muted grey (times, "Seen") readable across the background', () => {
    expect(contrast(ink.muted, variant.from)).toBeGreaterThanOrEqual(AA);
    expect(contrast(ink.muted, variant.to)).toBeGreaterThanOrEqual(AA);
  });
});

describe('the theme list', () => {
  it('has no duplicate ids', () => {
    const ids = CHAT_THEMES.map((theme) => theme.id);
    expect(new Set(ids).size).toBe(ids.length);
  });
});

describe('chat-service', () => {
  // The service validates theme ids against its own list and names them in
  // the thread ("… changed the theme to Ocean"). A theme added here and not
  // there is refused with a 400; one added there and not here falls back to
  // Classic. Read from its source, since the two are deployed separately.
  it('knows exactly the themes this list offers, by the same names', () => {
    const source = readFileSync(
      resolve(__dirname, '../../../../../backend/chat-service/src/services/appearanceService.ts'),
      'utf8'
    );
    const ids = [...source.match(/export const THEMES = \[([^\]]*)\]/)![1]!.matchAll(/'([a-z]+)'/g)].map((m) => m[1]);
    const names = Object.fromEntries(
      [...source.match(/const THEME_NAMES[^{]*\{([^}]*)\}/)![1]!.matchAll(/(\w+): '([^']+)'/g)].map((m) => [m[1], m[2]])
    );

    expect(ids).toEqual(CHAT_THEMES.map((theme) => theme.id));
    expect(names).toEqual(Object.fromEntries(CHAT_THEMES.map((theme) => [theme.id, theme.name])));
  });
});
