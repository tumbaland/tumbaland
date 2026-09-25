import { describe, it, expect } from 'vitest';
import {
  normalizeCollageConfig,
  normalizeCrop,
  serializeCollageDoc,
  photoHasFrame,
  DEFAULT_TEXT_COLOR,
  DEFAULT_TEXT_SIZE,
  MIN_CROP_SIZE,
  isQuarterTurned,
  normalizeOrientation,
  orientationTurns,
  rotateCropClockwise,
  sourceCrop,
  cleanTextPatch,
  isMovingType,
  isVideoType
} from './collageDoc';
import { CollageConfig } from '../../types/collage';

// A config exactly as the pre-refactor editor saved it.
const legacyV1Config = {
  version: '1.0',
  date: '2025-08-01T00:00:00.000Z',
  theme: 'default',
  viewport: { width: 1920, height: 1080 },
  backgroundColor: '#123456',
  borderColor: '#abcdef',
  photoTransparencyMode: true,
  photos: [
    {
      photoId: 'photo-1',
      filename: 'photo-1',
      caption: 'Beach day',
      position: { left: 50, top: 60 },
      width: 300,
      height: 200,
      rotation: 12,
      frameVisible: true,
      transparentBackground: false,
      scaleX: '1',
      scaleY: '1'
    },
    {
      // very old entry: no photoId, reference lives in filename, no position
      filename: 'photo-2',
      width: 120,
      height: 120
    }
  ],
  texts: [{ id: 'text-1', text: 'Summer\n2025', x: 10, y: 20, width: 180, height: 48 }],
  textSections: [{ some: 'legacy-data' }],
  title: { text: 'August', subtitle: 'our month' }
} as unknown as CollageConfig;

describe('normalizeCollageConfig', () => {
  it('reads a legacy v1 config', () => {
    const doc = normalizeCollageConfig(legacyV1Config);

    expect(doc.canvas).toEqual({ width: 1920, height: 1080 });
    expect(doc.background).toBe('#123456');
    expect(doc.frameColor).toBe('#abcdef');
    // photoTransparencyMode: true => global frames off
    expect(doc.frameEnabled).toBe(false);

    expect(doc.photos).toHaveLength(2);
    const [first, second] = doc.photos;
    expect(first.photoId).toBe('photo-1');
    expect(first).toMatchObject({ x: 50, y: 60, width: 300, height: 200, rotation: 12, caption: 'Beach day' });
    // transparentBackground: false => explicit frame on
    expect(first.frame).toBe(true);
    expect(photoHasFrame(doc, first)).toBe(true);

    expect(second.photoId).toBe('photo-2'); // falls back to filename
    expect(second.x).toBe(100); // v1 default position
    expect(second.frame).toBeUndefined(); // inherits global
    expect(photoHasFrame(doc, second)).toBe(false);

    expect(doc.texts).toHaveLength(1);
    expect(doc.texts[0]).toMatchObject({
      id: 'text-1',
      text: 'Summer\n2025',
      fontSize: DEFAULT_TEXT_SIZE,
      color: DEFAULT_TEXT_COLOR
    });
  });

  it('applies defaults for an empty or missing config', () => {
    const doc = normalizeCollageConfig(undefined);
    expect(doc.canvas.width).toBeGreaterThan(0);
    expect(doc.photos).toEqual([]);
    expect(doc.texts).toEqual([]);
    expect(doc.frameEnabled).toBe(false);
  });

  it('survives malformed numeric values', () => {
    const doc = normalizeCollageConfig({
      photos: [{ photoId: 'p', position: { left: 'NaN?', top: null }, width: '250', height: undefined }]
    } as unknown as CollageConfig);
    expect(doc.photos[0]).toMatchObject({ x: 100, y: 100, width: 250, height: 120 });
  });
});

describe('serializeCollageDoc', () => {
  it('round-trips a v1 config without losing layout or legacy keys', () => {
    const doc = normalizeCollageConfig(legacyV1Config);
    const config = serializeCollageDoc(doc, legacyV1Config);

    // unknown/legacy keys survive
    expect(config.textSections).toEqual([{ some: 'legacy-data' }]);
    expect(config.title).toEqual({ text: 'August', subtitle: 'our month' });
    expect(config.date).toBe('2025-08-01T00:00:00.000Z');

    // v1-compat fields are still written so an old reader could open it
    expect(config.photos[0].position).toEqual({ left: 50, top: 60 });
    expect(config.photos[0].filename).toBe('photo-1');
    expect(config.photos[0].transparentBackground).toBe(false);
    expect(config.photoTransparencyMode).toBe(true);
    expect(config.viewport).toEqual({ width: 1920, height: 1080 });

    // and normalizing the serialized config yields the same document
    const doc2 = normalizeCollageConfig(config);
    expect(doc2).toEqual(doc);
  });

  it('keeps per-photo frame overrides and text styling through a round-trip', () => {
    const doc = normalizeCollageConfig(legacyV1Config);
    doc.texts[0] = { ...doc.texts[0], fontSize: 64, color: '#00ff00' };
    doc.photos[1] = { ...doc.photos[1], frame: false };

    const doc2 = normalizeCollageConfig(serializeCollageDoc(doc, legacyV1Config));
    expect(doc2.texts[0].fontSize).toBe(64);
    expect(doc2.texts[0].color).toBe('#00ff00');
    expect(doc2.photos[1].frame).toBe(false);
  });
});

describe('crops', () => {
  it('keeps a stored crop that is a real sub-region', () => {
    const doc = normalizeCollageConfig({
      ...legacyV1Config,
      photos: [{ photoId: 'photo-1', width: 100, height: 100, crop: { x: 0.1, y: 0.2, width: 0.5, height: 0.4 } }]
    } as unknown as CollageConfig);

    expect(doc.photos[0].crop).toEqual({ x: 0.1, y: 0.2, width: 0.5, height: 0.4 });
  });

  it('drops a crop that covers the whole image', () => {
    expect(normalizeCrop({ x: 0, y: 0, width: 1, height: 1 })).toBeUndefined();
  });

  it('drops crops that are missing, malformed, or below the minimum size', () => {
    expect(normalizeCrop(undefined)).toBeUndefined();
    expect(normalizeCrop({ x: 0.1, y: 0.1, width: NaN, height: 0.5 })).toBeUndefined();
    expect(normalizeCrop({ x: 0.1, y: 0.1, width: MIN_CROP_SIZE / 2, height: 0.5 })).toBeUndefined();
  });

  it('clamps a crop into the image and to its remaining space', () => {
    const crop = normalizeCrop({ x: -0.5, y: 0.8, width: 2, height: 0.9 });

    expect(crop?.x).toBe(0);
    expect(crop?.y).toBe(0.8);
    expect(crop?.width).toBe(1);
    expect(crop?.height).toBeCloseTo(0.2);
  });

  it('round-trips a crop through serialize and normalize', () => {
    const doc = normalizeCollageConfig(legacyV1Config);
    const crop = { x: 0.25, y: 0.25, width: 0.5, height: 0.5 };
    doc.photos[0].crop = crop;

    const config = serializeCollageDoc(doc, legacyV1Config);

    expect(config.photos[0].crop).toEqual(crop);
    expect(normalizeCollageConfig(config).photos[0].crop).toEqual(crop);
  });
});

describe('orientation', () => {
  it('snaps a stored orientation to a quarter turn and drops upright', () => {
    expect(normalizeOrientation(90)).toBe(90);
    expect(normalizeOrientation(180)).toBe(180);
    expect(normalizeOrientation(0)).toBeUndefined();
    expect(normalizeOrientation(undefined)).toBeUndefined();
    expect(normalizeOrientation(360)).toBeUndefined();
    // off-quarter and negative values still land on a legal turn
    expect(normalizeOrientation(89)).toBe(90);
    expect(normalizeOrientation(-90)).toBe(270);
  });

  it('counts quarter turns and knows which ones swap the axes', () => {
    expect(orientationTurns(270)).toBe(3);
    expect(orientationTurns(-90)).toBe(3);
    expect(isQuarterTurned(90)).toBe(true);
    expect(isQuarterTurned(180)).toBe(false);
    expect(isQuarterTurned(undefined)).toBe(false);
  });

  it('carries a crop around the picture as it turns', () => {
    const topLeft = { x: 0, y: 0, width: 0.5, height: 0.5 };

    // turning the picture clockwise sends its top-left quarter to the top-right
    expect(rotateCropClockwise(topLeft, 1)).toEqual({ x: 0.5, y: 0, width: 0.5, height: 0.5 });
    expect(rotateCropClockwise(topLeft, 2)).toEqual({ x: 0.5, y: 0.5, width: 0.5, height: 0.5 });
    expect(rotateCropClockwise(topLeft, 3)).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 });
    expect(rotateCropClockwise(topLeft, 4)).toEqual(topLeft);
    expect(rotateCropClockwise(topLeft, -1)).toEqual({ x: 0, y: 0.5, width: 0.5, height: 0.5 });
    expect(rotateCropClockwise(undefined, 1)).toBeUndefined();
  });

  it('swaps the crop axes on a quarter turn', () => {
    expect(rotateCropClockwise({ x: 0.1, y: 0.2, width: 0.3, height: 0.4 }, 1)).toEqual({
      x: 1 - 0.2 - 0.4,
      y: 0.1,
      width: 0.4,
      height: 0.3
    });
  });

  it('maps a crop back onto the untouched source file', () => {
    const crop = { x: 0.5, y: 0, width: 0.5, height: 0.5 };
    // the crop was drawn on a picture turned 90° clockwise, so on the file
    // itself it is the top-left quarter again
    expect(sourceCrop({ crop, orientation: 90 })).toEqual({ x: 0, y: 0, width: 0.5, height: 0.5 });
    expect(sourceCrop({ crop, orientation: 0 })).toEqual(crop);
    expect(sourceCrop({ crop: undefined, orientation: 90 })).toBeUndefined();
  });

  it('round-trips an orientation through normalize and serialize', () => {
    const doc = normalizeCollageConfig({
      photos: [{ photoId: 'p1', width: 10, height: 10, orientation: 270 }]
    } as unknown as CollageConfig);

    expect(doc.photos[0].orientation).toBe(270);
    expect(serializeCollageDoc(doc).photos[0].orientation).toBe(270);
  });

  it('leaves an upright photo without an orientation', () => {
    const doc = normalizeCollageConfig({
      photos: [{ photoId: 'p1', width: 10, height: 10 }]
    } as unknown as CollageConfig);

    expect(doc.photos[0].orientation).toBeUndefined();
    expect(serializeCollageDoc(doc).photos[0].orientation).toBeUndefined();
  });
});

describe('text, sticker and shape styles', () => {
  const box = { id: 't1', text: 'Hi', x: 0, y: 0, width: 100, height: 40, fontSize: 20, color: '#000' };

  it('keeps a styled text through a save and a reload', () => {
    const styled = normalizeCollageConfig({
      ...({} as CollageConfig),
      photos: [],
      texts: [
        {
          ...box,
          fontFamily: 'hand',
          bold: false,
          italic: true,
          align: 'right',
          background: '#ff0',
          outline: '#fff',
          shadow: true,
          rotation: 12
        }
      ]
    });
    const again = normalizeCollageConfig(serializeCollageDoc(styled));

    expect(again.texts[0]).toEqual(styled.texts[0]);
    expect(again.texts[0]).toMatchObject({
      fontFamily: 'hand',
      bold: false,
      italic: true,
      align: 'right',
      rotation: 12
    });
  });

  it('writes nothing for a default, so a text from before styles reads as unchanged', () => {
    const plain = normalizeCollageConfig({
      ...({} as CollageConfig),
      photos: [],
      texts: [{ ...box, fontFamily: 'sans', bold: true, italic: false, align: 'center', background: '', rotation: 0 }]
    });

    expect(Object.keys(plain.texts[0]).sort()).toEqual([
      'color',
      'fontSize',
      'height',
      'id',
      'text',
      'width',
      'x',
      'y'
    ]);
  });

  it('keeps a known shape and drops one it cannot draw', () => {
    const doc = normalizeCollageConfig({
      ...({} as CollageConfig),
      photos: [],
      texts: [
        { ...box, id: 'a', kind: 'shape', shape: 'heart' },
        { ...box, id: 'b', kind: 'shape', shape: 'dodecahedron' },
        { ...box, id: 'c', kind: 'sticker', text: '🎉' }
      ]
    });

    expect(doc.texts[0]).toMatchObject({ kind: 'shape', shape: 'heart' });
    expect(doc.texts[1]!.kind).toBeUndefined();
    expect(doc.texts[2]).toMatchObject({ kind: 'sticker', text: '🎉' });
  });

  it('cleanTextPatch turns defaults into undefined and leaves other fields alone', () => {
    expect(
      cleanTextPatch({ bold: true, italic: false, align: 'center', rotation: 0, fontFamily: 'sans', x: 5 })
    ).toEqual({
      bold: undefined,
      italic: undefined,
      align: undefined,
      rotation: undefined,
      fontFamily: undefined,
      x: 5
    });
    expect(cleanTextPatch({ bold: false, align: 'left', rotation: 45 })).toEqual({
      bold: false,
      align: 'left',
      rotation: 45
    });
  });

  it('tells videos and GIFs apart from stills', () => {
    expect(isVideoType('video/mp4')).toBe(true);
    expect(isVideoType('image/gif')).toBe(false);
    expect(isMovingType('image/gif')).toBe(true);
    expect(isMovingType('image/png')).toBe(false);
  });
});
