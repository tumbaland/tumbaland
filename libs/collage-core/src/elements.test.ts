import { describe, it, expect } from 'vite-plus/test';
import { globalCanvasEnv } from './canvas';
import { CollageTextItem } from './doc';
import { drawOverlayItem, fontById, fontShorthand, labelPadding, stickerFontSize, wrapLines } from './elements';
import { fakeEnv, named, recordingContext } from './testUtils';

const text = (overrides: Partial<CollageTextItem> = {}): CollageTextItem => ({
  id: 't1',
  text: 'Hello',
  x: 100,
  y: 100,
  width: 200,
  height: 60,
  fontSize: 32,
  color: '#e91e63',
  ...overrides
});

describe('fonts', () => {
  it('falls back to the plain sans for a font it does not know', () => {
    expect(fontById('nope').id).toBe('sans');
    expect(fontById('hand').family).toContain('Caveat');
  });

  it('writes the CSS font shorthand, bold unless told otherwise', () => {
    expect(fontShorthand(text({ fontFamily: 'hand' }))).toBe('700 32px "Caveat", cursive');
    expect(fontShorthand(text({ bold: false, italic: true }))).toBe('italic 400 32px Inter, system-ui, sans-serif');
  });

  it('draws a sticker in an emoji font, sized to its box', () => {
    const sticker = text({ kind: 'sticker', text: '❤️', width: 100, height: 80 });
    expect(stickerFontSize(sticker)).toBe(64);
    expect(fontShorthand(sticker, 64)).toContain('Noto Color Emoji');
  });

  it('pads a label only when it has a background or leans to a side', () => {
    expect(labelPadding(text())).toBe(0);
    expect(labelPadding(text({ align: 'left' }))).toBeCloseTo(9.6);
    expect(labelPadding(text({ background: '#fff' }))).toBeCloseTo(9.6);
  });
});

describe('wrapLines', () => {
  it('breaks between words where a line would run past the width', () => {
    // The recording context measures 10 units a character.
    expect(wrapLines(recordingContext(), 'one two three', 80)).toEqual(['one two', 'three']);
  });

  it('keeps the lines someone typed', () => {
    expect(wrapLines(recordingContext(), 'one\ntwo', 500)).toEqual(['one', 'two']);
  });
});

describe('drawOverlayItem', () => {
  it('writes text centred in its box, about the centre', () => {
    const ctx = recordingContext();
    drawOverlayItem(ctx, text(), fakeEnv());

    expect(named(ctx.calls, 'translate')[0]!.args).toEqual([200, 130]);
    const [line] = named(ctx.calls, 'fillText');
    expect(line).toMatchObject({ args: ['Hello', 0, expect.closeTo(0)], fillStyle: '#e91e63' });
    expect(ctx.textAlign).toBe('center');
  });

  it('draws the label, outline and shadow a text asks for', () => {
    const ctx = recordingContext();
    drawOverlayItem(ctx, text({ background: '#ffffff', outline: '#000000', shadow: true, align: 'left' }), fakeEnv());

    expect(named(ctx.calls, 'roundRect')).toHaveLength(1);
    expect(named(ctx.calls, 'strokeText')).toHaveLength(1);
    expect(ctx.shadowBlur).toBeGreaterThan(0);
    // Left-aligned text starts inside the padding, not at the centre.
    expect(named(ctx.calls, 'fillText')[0]!.args[1]).toBeLessThan(0);
  });

  it('falls back to a plain rectangle for a label where roundRect is missing', () => {
    const ctx = recordingContext();
    delete (ctx as { roundRect?: unknown }).roundRect;
    drawOverlayItem(ctx, text({ background: '#ffffff', align: 'right' }), fakeEnv());
    expect(named(ctx.calls, 'rect')).toHaveLength(1);
  });

  it('draws a sticker as one line, never outlined', () => {
    const ctx = recordingContext();
    drawOverlayItem(ctx, text({ kind: 'sticker', text: '🎉', outline: '#000' }), fakeEnv());

    expect(named(ctx.calls, 'fillText')).toHaveLength(1);
    expect(named(ctx.calls, 'strokeText')).toHaveLength(0);
  });

  it('draws a shape from its path, scaled to its box, with its outline', () => {
    const ctx = recordingContext();
    drawOverlayItem(
      ctx,
      text({ kind: 'shape', shape: 'circle', width: 50, height: 100, outline: '#000', shadow: true }),
      fakeEnv()
    );

    const [path] = named(ctx.calls, 'fill')[0]!.args as [{ parts: Array<{ transform: { steps: string[] } }> }];
    expect(path.parts[0]!.transform.steps).toEqual(['translate(-25,-50)', 'scale(0.5,1)']);
    expect(named(ctx.calls, 'stroke')).toHaveLength(1);
  });

  it('says what is missing when a shape is drawn with no Path2D to hand', () => {
    expect(() => globalCanvasEnv()).toThrow(/pass a CanvasEnv/);
  });
});
