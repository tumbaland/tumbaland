import type { CollageDoc, CollagePhotoItem, CollageTextItem } from '@tumbaland/collage-core';

export interface Geometry {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation: number;
}

export interface Point {
  x: number;
  y: number;
}

/** Smallest an item can be made, in canvas units. */
export const MIN_SIZE = 40;

/** Handles on a touch screen: a fingertip, not a cursor. */
export const coarsePointer = () =>
  typeof window !== 'undefined' && typeof window.matchMedia === 'function' && window.matchMedia('(pointer: coarse)').matches;

export const distance = (a: Point, b: Point) => Math.hypot(b.x - a.x, b.y - a.y);
export const angleOf = (a: Point, b: Point) => (Math.atan2(b.y - a.y, b.x - a.x) * 180) / Math.PI;

/** An angle in (-180, 180], the range rotations are stored in. */
const normalizeAngle = (angle: number) => {
  let a = angle % 360;
  if (a > 180) a -= 360;
  if (a <= -180) a += 360;
  return a;
};

/**
 * Two fingers on an item: spreading them resizes it about its centre, turning
 * them turns it, and moving both moves it.
 */
export const pinchGeometry = (
  start: Geometry,
  from: { a: Point; b: Point },
  to: { a: Point; b: Point },
  scale: number
): Geometry => {
  const startDistance = distance(from.a, from.b);
  let factor = startDistance > 0 ? distance(to.a, to.b) / startDistance : 1;
  factor = Math.max(factor, MIN_SIZE / Math.max(1, Math.min(start.width, start.height)));
  const width = start.width * factor;
  const height = start.height * factor;

  const mid = (p: { a: Point; b: Point }) => ({ x: (p.a.x + p.b.x) / 2, y: (p.a.y + p.b.y) / 2 });
  const fromMid = mid(from);
  const toMid = mid(to);
  const centerX = start.x + start.width / 2 + (toMid.x - fromMid.x) / scale;
  const centerY = start.y + start.height / 2 + (toMid.y - fromMid.y) / scale;

  const rotation = Math.round(normalizeAngle(start.rotation + angleOf(to.a, to.b) - angleOf(from.a, from.b)));
  return { x: centerX - width / 2, y: centerY - height / 2, width, height, rotation };
};

/** An item's geometry as it is now in the doc. */
export const findCurrent = (doc: CollageDoc, id: string): Geometry | null => {
  const item: (CollagePhotoItem | CollageTextItem) | undefined =
    doc.photos.find((p) => p.id === id) ?? doc.texts.find((t) => t.id === id);
  if (!item) return null;
  return {
    x: item.x,
    y: item.y,
    width: item.width,
    height: item.height,
    rotation: item.rotation || 0
  };
};
