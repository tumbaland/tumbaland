import { createCanvas, GlobalFonts, Image, loadImage } from '@napi-rs/canvas';
import { COLLAGE_FONTS, CollageDoc } from '@tumbaland/collage-core';
import { drawCollagePreview, drawContactSheet, MAX_PREVIEW_HEIGHT, MAX_PREVIEW_WIDTH } from './draw';
import { FONT_PACKAGES, primaryFamily, registerCollageFonts } from './fonts';

const solid = async (width: number, height: number, colour: string): Promise<Image> => {
  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = colour;
  ctx.fillRect(0, 0, width, height);
  return loadImage(await canvas.encode('png'));
};

const pixel = async (image: Buffer, x: number, y: number): Promise<number[]> => {
  const decoded = await loadImage(image);
  const canvas = createCanvas(decoded.width, decoded.height);
  const ctx = canvas.getContext('2d');
  ctx.drawImage(decoded, 0, 0);
  return Array.from(ctx.getImageData(x, y, 1, 1).data.slice(0, 3));
};

const close = (actual: number[], expected: number[]) =>
  actual.every((value, index) => Math.abs(value - expected[index]!) < 24);

const doc: CollageDoc = {
  canvas: { width: 1600, height: 900 },
  background: '#ffffff',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [{ id: 'a', photoId: 'ph1', x: 800, y: 0, width: 800, height: 900, rotation: 0, caption: '' }],
  texts: [
    { id: 't', text: '🎉', kind: 'sticker', x: 0, y: 0, width: 200, height: 200, fontSize: 32, color: '#000' },
    { id: 's', text: '', kind: 'shape', shape: 'heart', x: 0, y: 600, width: 200, height: 200, fontSize: 32, color: '#e91e63' }
  ]
};

describe('fonts', () => {
  it('has a package for every font the editor offers, and registers each family', () => {
    registerCollageFonts();
    const families = new Set(GlobalFonts.families.map((family) => family.family));

    for (const font of COLLAGE_FONTS) {
      expect(FONT_PACKAGES[font.id]).toBeDefined();
      expect(families).toContain(primaryFamily(font.family));
    }
    expect(families).toContain('Noto Color Emoji');
    expect(families).toContain('sans-serif');
  });
});

describe('drawCollagePreview', () => {
  it('draws the collage at the width asked for, photos and shapes included', async () => {
    const drawn = await drawCollagePreview(doc, new Map([['ph1', await solid(40, 45, '#00ff00')]]), {
      width: 800,
      outline: false
    });

    expect(drawn).toMatchObject({ width: 800, height: 450, mimeType: 'image/jpeg' });
    expect(close(await pixel(drawn.image, 600, 225), [0, 255, 0])).toBe(true);
    expect(close(await pixel(drawn.image, 300, 225), [255, 255, 255])).toBe(true);
    // The heart, in its pink, from the server's own Path2D.
    expect(close(await pixel(drawn.image, 50, 350), [233, 30, 99])).toBe(true);
  });

  it('keeps a very tall canvas within the height it will draw', async () => {
    const tall = { ...doc, canvas: { width: 200, height: 8000 }, photos: [], texts: [] };
    const drawn = await drawCollagePreview(tall, new Map(), { width: 1024, outline: false });
    expect(drawn.height).toBe(MAX_PREVIEW_HEIGHT);
    expect(drawn.width).toBe(Math.round((200 * MAX_PREVIEW_HEIGHT) / 8000));
  });

  it('keeps the width within what it will draw', async () => {
    const drawn = await drawCollagePreview(doc, new Map(), { width: 99_999, outline: false });
    expect(drawn.width).toBe(MAX_PREVIEW_WIDTH);
  });

  it('outlines each item and tags it with its short name', async () => {
    const plain = await drawCollagePreview(doc, new Map(), { width: 800, outline: false });
    const outlined = await drawCollagePreview(doc, new Map(), { width: 800, outline: true });

    // The tag sits at the photo's top-left corner, in the label pink.
    expect(close(await pixel(plain.image, 404, 4), [233, 30, 99])).toBe(false);
    expect(close(await pixel(outlined.image, 404, 4), [233, 30, 99])).toBe(true);
  });
});

describe('drawContactSheet', () => {
  it('lays pictures out six to a row, and says so where one is missing', async () => {
    const cells = await Promise.all(
      Array.from({ length: 7 }, async (_, index) => ({
        n: index + 1,
        picture: index === 6 ? undefined : await solid(300, 200, '#ff0000')
      }))
    );

    const sheet = await drawContactSheet(cells);

    expect(sheet).toMatchObject({ width: 6 * 200 + 7 * 8, height: 2 * 200 + 3 * 8 });
    // The middle of the first cell is the picture.
    expect(close(await pixel(sheet.image, 108, 108), [255, 0, 0])).toBe(true);
  });

  it('is one cell wide for an empty page', async () => {
    const sheet = await drawContactSheet([]);
    expect(sheet.width).toBe(216);
  });
});
