import { afterEach, describe, expect, it, vi } from 'vite-plus/test';
import { CollageTextItem } from '@tumbaland/collage-core';
import { ensureCollageFonts, loadFontsFor, textCss } from './collageElements';

const text = (overrides: Partial<CollageTextItem> = {}): CollageTextItem => ({
  id: 't1',
  text: 'Hello',
  x: 0,
  y: 0,
  width: 200,
  height: 60,
  fontSize: 32,
  color: '#e91e63',
  ...overrides
});

afterEach(() => {
  document.getElementById('tumbaland-collage-fonts')?.remove();
  vi.restoreAllMocks();
});

describe('ensureCollageFonts', () => {
  it('adds the font stylesheet once, however often it is asked', () => {
    ensureCollageFonts();
    ensureCollageFonts();

    const links = document.querySelectorAll('#tumbaland-collage-fonts');
    expect(links).toHaveLength(1);
    expect((links[0] as HTMLLinkElement).href).toContain('family=Caveat');
  });
});

describe('loadFontsFor', () => {
  it('waits for the fonts the texts use, and not for stickers or shapes', async () => {
    const load = vi.fn().mockResolvedValue([]);
    Object.defineProperty(document, 'fonts', { value: { load }, configurable: true });

    await loadFontsFor([
      text({ fontFamily: 'hand' }),
      text({ kind: 'sticker', text: '🎉' }),
      text({ kind: 'shape', shape: 'heart' })
    ]);

    expect(load).toHaveBeenCalledTimes(1);
    expect(load.mock.calls[0]![0]).toContain('Caveat');
  });
});

describe('textCss', () => {
  it('sizes a sticker to its box, in an emoji font', () => {
    const css = textCss(text({ kind: 'sticker', width: 100, height: 100 }));
    expect(css.fontSize).toBe(80);
    expect(String(css.fontFamily)).toContain('Emoji');
  });

  it('carries the outline and shadow a text asks for', () => {
    const css = textCss(text({ outline: '#000', shadow: true, bold: false, italic: true, align: 'left' }));
    expect(css).toMatchObject({ fontWeight: 400, fontStyle: 'italic', textAlign: 'left' });
    expect(css.WebkitTextStroke).toContain('#000');
    expect(css.textShadow).toBeDefined();
  });

  it('is bold and centred by default', () => {
    expect(textCss(text())).toMatchObject({ fontWeight: 700, fontStyle: 'normal', textAlign: 'center' });
  });
});
