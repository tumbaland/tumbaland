import { describe, it, expect } from 'vitest';
import { normalizeCollageConfig, photoHasFrame, CollageDoc } from './collageDoc';

const docWith = (overrides: Partial<CollageDoc>): CollageDoc => ({
  canvas: { width: 1600, height: 900 },
  background: '#111111',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [],
  texts: [],
  ...overrides
});

const photo = (frame: boolean | undefined) => ({
  id: 'p1', photoId: 'ph1', x: 0, y: 0, width: 100, height: 100, rotation: 0, caption: '', frame
});

describe('photoHasFrame', () => {
  it('uses the per-photo override when set', () => {
    expect(photoHasFrame(docWith({ frameEnabled: false }), photo(true))).toBe(true);
    expect(photoHasFrame(docWith({ frameEnabled: true }), photo(false))).toBe(false);
  });

  it('falls back to the document frameEnabled when the photo has no override', () => {
    expect(photoHasFrame(docWith({ frameEnabled: true }), photo(undefined))).toBe(true);
    expect(photoHasFrame(docWith({ frameEnabled: false }), photo(undefined))).toBe(false);
  });
});

describe('normalizeCollageConfig frame/transparency inference', () => {
  it('maps a v1 transparentBackground flag to the inverse frame state', () => {
    const doc = normalizeCollageConfig({
      photos: [
        { photoId: 'a', transparentBackground: true }, // transparent → no frame
        { photoId: 'b', transparentBackground: false } // opaque → framed
      ]
    } as any);

    expect(doc.photos[0].frame).toBe(false);
    expect(doc.photos[1].frame).toBe(true);
  });

  it('prefers an explicit v2 frame flag over legacy transparency', () => {
    const doc = normalizeCollageConfig({
      photos: [{ photoId: 'a', frame: true, transparentBackground: true }]
    } as any);

    expect(doc.photos[0].frame).toBe(true);
  });

  it('leaves frame undefined (inherit) when neither flag is present', () => {
    const doc = normalizeCollageConfig({ photos: [{ photoId: 'a' }] } as any);
    expect(doc.photos[0].frame).toBeUndefined();
  });

  it('derives document frameEnabled from the v1 photoTransparencyMode flag', () => {
    expect(normalizeCollageConfig({ photoTransparencyMode: true } as any).frameEnabled).toBe(false);
    expect(normalizeCollageConfig({ photoTransparencyMode: false } as any).frameEnabled).toBe(true);
    // default when unspecified: frames off
    expect(normalizeCollageConfig({} as any).frameEnabled).toBe(false);
  });
});
