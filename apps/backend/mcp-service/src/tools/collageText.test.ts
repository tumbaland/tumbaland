import { CollageDoc, CollagePhotoItem, CollageTextItem } from '@tumbaland/collage-core';
import { checkCollage, describeCollage, describeLayout, describeMaker, photoInfoOf, PhotoInfo } from './collageText';
import type { Collage } from '../collage';

const photo = (overrides: Partial<CollagePhotoItem> = {}): CollagePhotoItem => ({
  id: 'a',
  photoId: 'ph1',
  x: 0,
  y: 0,
  width: 800,
  height: 600,
  rotation: 0,
  caption: '',
  ...overrides
});

const text = (overrides: Partial<CollageTextItem> = {}): CollageTextItem => ({
  id: 't',
  text: 'Saaremaa',
  x: 100,
  y: 700,
  width: 600,
  height: 80,
  fontSize: 64,
  color: '#e91e63',
  ...overrides
});

const doc = (overrides: Partial<CollageDoc> = {}): CollageDoc => ({
  canvas: { width: 1600, height: 900 },
  background: '#fce4ec',
  frameEnabled: false,
  frameColor: '#ffffff',
  photos: [photo(), photo({ id: 'b', photoId: 'ph2', x: 800 })],
  texts: [],
  ...overrides
});

const photos = new Map<string, PhotoInfo>([
  ['ph1', { name: 'beach.jpg', dateTaken: '2025-07-02', aspect: 4 / 3, video: false }],
  ['ph2', { name: 'harbour.jpg', aspect: 4 / 3, video: false }]
]);

describe('photoInfoOf', () => {
  it('names a photo by its title, then its original name, and knows its shape', () => {
    const info = photoInfoOf([
      { _id: '1', title: 'Sunset', originalName: 'IMG_1.jpg', filename: 'x', mimetype: 'image/jpeg', width: 400, height: 300, tags: [] },
      { _id: '2', originalName: 'IMG_2.mp4', filename: 'y', mimetype: 'video/mp4', dateTaken: '2025-07-02T10:00:00Z', tags: [] }
    ]);

    expect(info.get('1')).toEqual({ name: 'Sunset', aspect: 4 / 3, video: false, dateTaken: undefined });
    expect(info.get('2')).toEqual({ name: 'IMG_2.mp4', aspect: undefined, video: true, dateTaken: '2025-07-02' });
  });
});

describe('describeLayout', () => {
  it('names every item the way the tools take it, bottom to top', () => {
    const lines = describeLayout(
      doc({
        photos: [photo({ rotation: -4, caption: 'Kuressaare', crop: { x: 0, y: 0, width: 1, height: 0.5 } })],
        texts: [
          text({ fontFamily: 'hand', bold: false, italic: true, align: 'left', background: '#fff', outline: '#000', shadow: true }),
          text({ id: 's', kind: 'sticker', text: '❤️' }),
          text({ id: 'h', kind: 'shape', shape: 'heart', outline: '#333' })
        ]
      }),
      photos
    ).join('\n');

    expect(lines).toContain('p1  beach.jpg (2025-07-02), at 0,0 size 800×600, tilted -4°, showing 100%×50% from 0%,0%, caption "Kuressaare"  [photo ph1]');
    expect(lines).toContain('t1  text "Saaremaa" in Handwritten 64px regular italic #e91e63 left-aligned on #fff outlined #000 shadow');
    expect(lines).toContain('t2  sticker ❤️');
    expect(lines).toContain('t3  heart shape in #e91e63, outlined #333');
  });

  it('says so when there are no photos yet', () => {
    expect(describeLayout(doc({ photos: [] }), photos)).toEqual(['No photos yet.']);
  });

  it('marks a turned and framed photo, and a video', () => {
    const lines = describeLayout(doc({ frameEnabled: true, photos: [photo({ orientation: 90 })] }), new Map([
      ['ph1', { name: 'clip.mp4', video: true }]
    ])).join('\n');

    expect(lines).toContain('video clip.mp4');
    expect(lines).toContain('picture turned 90°, framed');
  });
});

describe('checkCollage', () => {
  it('finds nothing wrong with a tidy collage', () => {
    expect(checkCollage(doc({ texts: [text({ y: 0, x: 0 })] }), photos)).toEqual([]);
  });

  it('says when there are no photos', () => {
    expect(checkCollage(doc({ photos: [] }), photos)).toContain('There are no photos on it yet.');
  });

  it('finds items hanging off the canvas, or off it altogether', () => {
    const problems = checkCollage(doc({ photos: [photo({ x: 1200 }), photo({ id: 'b', photoId: 'ph2', x: 5000 })] }), photos);

    expect(problems).toContain('p1 hangs 50% off the edge of the canvas.');
    expect(problems).toContain('p2 is entirely off the canvas.');
  });

  it('finds a photo used twice, and one no longer in the albums', () => {
    const problems = checkCollage(
      doc({ photos: [photo(), photo({ id: 'b', x: 800 }), photo({ id: 'c', photoId: 'gone', y: 600, height: 300 })] }),
      photos
    );

    expect(problems).toContain('p2 is the same photo as p1.');
    expect(problems.some((problem) => problem.startsWith('p3 shows a photo that is no longer'))).toBe(true);
  });

  it('finds photos covering each other', () => {
    const problems = checkCollage(doc({ photos: [photo(), photo({ id: 'b', photoId: 'ph2', x: 100, y: 50 })] }), photos);
    expect(problems.some((problem) => problem.startsWith('p2 covers') && problem.includes('hiding most of it'))).toBe(true);
  });

  it('finds a photo showing little of itself, but not one cropped on purpose', () => {
    const narrow = photo({ width: 200, height: 900 });
    expect(checkCollage(doc({ photos: [narrow] }), photos).some((problem) => problem.includes('shows only'))).toBe(true);

    const cropped = { ...narrow, crop: { x: 0, y: 0, width: 0.3, height: 1 } };
    expect(checkCollage(doc({ photos: [cropped] }), photos).some((problem) => problem.includes('shows only'))).toBe(false);
  });

  it('judges a turned photo by the shape it shows', () => {
    // A 4:3 picture turned a quarter is 3:4, which suits a tall box.
    const turned = photo({ width: 300, height: 400, orientation: 90 });
    expect(checkCollage(doc({ photos: [turned] }), photos).some((problem) => problem.includes('shows only'))).toBe(false);
  });

  it('finds tiny photos, small or overflowing text and empty texts', () => {
    const problems = checkCollage(
      doc({
        photos: [photo({ width: 40, height: 40 })],
        texts: [text({ fontSize: 12, height: 20 }), text({ id: 'e', text: ' ' }), text({ id: 'l', text: 'A very long line of words indeed', width: 200, height: 70 })]
      }),
      photos
    );

    expect(problems).toContain('p1 is very small (40×40).');
    expect(problems).toContain('t1 is 12px, small to read on a 1600 wide collage.');
    expect(problems).toContain('t2 is an empty text.');
    expect(problems).toContain("t3's text may not fit its box; make it taller or the text smaller.");
  });

  it('notices a canvas that is mostly empty', () => {
    const problems = checkCollage(doc({ photos: [photo({ width: 400, height: 300 })] }), photos);
    expect(problems.some((problem) => problem.startsWith('Only'))).toBe(true);
  });
});

describe('describeCollage', () => {
  const collage = { _id: 'c1', title: 'Saaremaa', albumIds: [], config: {} } as unknown as Collage;

  it('says who made it, and so whether it can be changed', () => {
    expect(describeMaker({ ...collage, madeBy: { kind: 'assistant', label: 'Claude' } })).toBe(
      'Made by Claude, so you can change it.'
    );
    expect(describeMaker(collage)).toMatch(/cannot change it/);
  });

  it('puts the settings, the layout and the problems together', () => {
    const description = describeCollage(collage, doc(), photos, ['Saaremaa 2025']);

    expect(description).toContain('"Saaremaa" (id c1): 1600×900, background #fce4ec, frames off.');
    expect(description).toContain('Photos come from Saaremaa 2025; 2 to choose from.');
    expect(description).toContain('Nothing looks wrong.');
  });

  it('lists the problems when there are some', () => {
    const description = describeCollage(collage, doc({ photos: [], frameEnabled: true }), photos, []);
    expect(description).toContain('frames on, in #ffffff');
    expect(description).toContain('Photos come from its albums');
    expect(description).toContain('Worth a look:\n  - There are no photos on it yet.');
  });
});
