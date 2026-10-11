import { CollageCrop, normalizeCrop } from './doc';

/** Which part of a picture to keep when its box is a different shape. */
export type CropFocus = 'center' | 'top' | 'bottom' | 'left' | 'right';

export const CROP_FOCUSES: readonly CropFocus[] = ['center', 'top', 'bottom', 'left', 'right'];

/** Above this share of the picture kept, a crop changes nothing anyone would see. */
const NEGLIGIBLE_CROP = 0.97;

/**
 * The crop that fills a box of `boxAspect` (width / height) from a picture of
 * `imageAspect`, keeping the part `focus` names.
 *
 * Centred needs no crop at all: a photo is always drawn to cover its box from
 * the middle of whatever region it shows, so `center` answers undefined, as
 * does a picture already within a few percent of the box's shape. Any
 * other focus pins the kept region to that edge. A focus across the axis that
 * is not cropped (top on a picture that is only cropped at the sides) keeps the
 * middle of that axis, which is what the editor would show anyway.
 */
export const focusCrop = (imageAspect: number, boxAspect: number, focus: CropFocus): CollageCrop | undefined => {
  if (focus === 'center' || !(imageAspect > 0) || !(boxAspect > 0)) return undefined;
  if (Math.min(imageAspect / boxAspect, boxAspect / imageAspect) > NEGLIGIBLE_CROP) return undefined;

  if (imageAspect > boxAspect) {
    const width = boxAspect / imageAspect;
    const x = focus === 'left' ? 0 : focus === 'right' ? 1 - width : (1 - width) / 2;
    return normalizeCrop({ x, y: 0, width, height: 1 });
  }
  const height = imageAspect / boxAspect;
  const y = focus === 'top' ? 0 : focus === 'bottom' ? 1 - height : (1 - height) / 2;
  return normalizeCrop({ x: 0, y, width: 1, height });
};

export interface Box {
  x: number;
  y: number;
  width: number;
  height: number;
  rotation?: number;
}

/** The upright rectangle a box covers once it is turned about its centre. */
export const boundsOf = (box: Box): { left: number; top: number; right: number; bottom: number } => {
  const radians = ((box.rotation ?? 0) * Math.PI) / 180;
  const cos = Math.abs(Math.cos(radians));
  const sin = Math.abs(Math.sin(radians));
  const width = box.width * cos + box.height * sin;
  const height = box.width * sin + box.height * cos;
  const cx = box.x + box.width / 2;
  const cy = box.y + box.height / 2;
  return { left: cx - width / 2, top: cy - height / 2, right: cx + width / 2, bottom: cy + height / 2 };
};

/**
 * How much of two boxes lies on top of each other, as an area.
 *
 * Measured on their upright bounds, so a tilted photo counts as covering a
 * little more than it does. Good enough for "these two overlap a lot", which
 * is all it is asked.
 */
export const overlapArea = (a: Box, b: Box): number => {
  const first = boundsOf(a);
  const second = boundsOf(b);
  const width = Math.min(first.right, second.right) - Math.max(first.left, second.left);
  const height = Math.min(first.bottom, second.bottom) - Math.max(first.top, second.top);
  return width > 0 && height > 0 ? width * height : 0;
};

/** The share of a box, 0 to 1, that lies outside a canvas of the given size. */
export const shareOutside = (box: Box, canvas: { width: number; height: number }): number => {
  const bounds = boundsOf(box);
  const area = (bounds.right - bounds.left) * (bounds.bottom - bounds.top);
  if (area <= 0) return 0;
  const width = Math.min(bounds.right, canvas.width) - Math.max(bounds.left, 0);
  const height = Math.min(bounds.bottom, canvas.height) - Math.max(bounds.top, 0);
  const inside = width > 0 && height > 0 ? width * height : 0;
  return 1 - inside / area;
};
