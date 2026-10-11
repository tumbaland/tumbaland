import { describe, it, expect } from 'vite-plus/test';
import { boundsOf, focusCrop, overlapArea, shareOutside } from './geometry';

describe('focusCrop', () => {
  it('needs no crop to keep the middle, since every photo covers its box from the middle', () => {
    expect(focusCrop(4 / 3, 1, 'center')).toBeUndefined();
  });

  it('keeps the top of a tall picture in a wide box', () => {
    // 3:4 portrait into a 3:2 box: half of its height shows.
    expect(focusCrop(3 / 4, 3 / 2, 'top')).toEqual({ x: 0, y: 0, width: 1, height: 0.5 });
    expect(focusCrop(3 / 4, 3 / 2, 'bottom')).toEqual({ x: 0, y: 0.5, width: 1, height: 0.5 });
  });

  it('keeps a side of a wide picture in a narrow box', () => {
    expect(focusCrop(2, 1, 'left')).toEqual({ x: 0, y: 0, width: 0.5, height: 1 });
    expect(focusCrop(2, 1, 'right')).toEqual({ x: 0.5, y: 0, width: 0.5, height: 1 });
  });

  it('keeps the middle of the axis a focus does not cross', () => {
    // Top on a picture that is only cropped at the sides.
    expect(focusCrop(2, 1, 'top')).toEqual({ x: 0.25, y: 0, width: 0.5, height: 1 });
    expect(focusCrop(1 / 2, 1, 'left')).toEqual({ x: 0, y: 0.25, width: 1, height: 0.5 });
  });

  it('answers no crop when the shapes already match or a size is unknown', () => {
    expect(focusCrop(1.5, 1.5, 'top')).toBeUndefined();
    // A 3:4 photo in a framed 420×560 box: within a couple of percent, nothing to keep or lose.
    expect(focusCrop(0.75, 396 / 536, 'top')).toBeUndefined();
    expect(focusCrop(0, 1, 'top')).toBeUndefined();
    expect(focusCrop(Number.NaN, 1, 'left')).toBeUndefined();
  });
});

describe('boundsOf', () => {
  it('is the box itself when it is upright', () => {
    expect(boundsOf({ x: 10, y: 20, width: 100, height: 50 })).toEqual({ left: 10, top: 20, right: 110, bottom: 70 });
  });

  it('swaps width and height at a quarter turn, about the centre', () => {
    const bounds = boundsOf({ x: 0, y: 0, width: 100, height: 50, rotation: 90 });
    expect(bounds.left).toBeCloseTo(25);
    expect(bounds.top).toBeCloseTo(-25);
    expect(bounds.right).toBeCloseTo(75);
    expect(bounds.bottom).toBeCloseTo(75);
  });
});

describe('overlapArea', () => {
  it('is the shared rectangle', () => {
    expect(overlapArea({ x: 0, y: 0, width: 100, height: 100 }, { x: 50, y: 50, width: 100, height: 100 })).toBe(
      2500
    );
  });

  it('is nothing for boxes that only touch', () => {
    expect(overlapArea({ x: 0, y: 0, width: 100, height: 100 }, { x: 100, y: 0, width: 100, height: 100 })).toBe(0);
  });
});

describe('shareOutside', () => {
  const canvas = { width: 1000, height: 500 };

  it('is nothing for a box on the canvas', () => {
    expect(shareOutside({ x: 10, y: 10, width: 100, height: 100 }, canvas)).toBe(0);
  });

  it('is the part hanging over an edge', () => {
    expect(shareOutside({ x: 950, y: 0, width: 100, height: 100 }, canvas)).toBeCloseTo(0.5);
  });

  it('is all of a box off the canvas', () => {
    expect(shareOutside({ x: 2000, y: 0, width: 100, height: 100 }, canvas)).toBe(1);
  });

  it('is nothing for a box with no size', () => {
    expect(shareOutside({ x: 2000, y: 0, width: 0, height: 0 }, canvas)).toBe(0);
  });
});
