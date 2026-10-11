import {
  boundsOf,
  CollageDoc,
  CollagePhotoItem,
  CollageTextItem,
  fontById,
  isQuarterTurned,
  overlapArea,
  photoHasFrame,
  shareOutside,
  shortIdsOf,
  TEXT_LINE_HEIGHT
} from '@tumbaland/collage-core';
import type { Collage, CollagePhoto } from '../collage';

/**
 * A collage in words, and what looks wrong with it.
 *
 * The model reads this before it changes anything and after every change, so
 * it is written to be acted on: every item has the short name the tools take
 * and the preview draws, every number is in canvas units, and every problem
 * names the items it is about.
 */

/** What is known about a photo without looking at it. */
export interface PhotoInfo {
  name: string;
  dateTaken?: string;
  /** width over height of the original, when its size was recorded */
  aspect?: number;
  video: boolean;
}

export const photoInfoOf = (photos: CollagePhoto[]): Map<string, PhotoInfo> =>
  new Map(
    photos.map((photo) => [
      photo._id,
      {
        name: photo.title || photo.originalName || photo.filename || photo._id,
        dateTaken: photo.dateTaken?.slice(0, 10),
        aspect: photo.width && photo.height ? photo.width / photo.height : undefined,
        video: photo.mimetype.startsWith('video/')
      }
    ])
  );

const round = (value: number): number => Math.round(value);
const percent = (share: number): string => `${Math.round(share * 100)}%`;

const box = (item: { x: number; y: number; width: number; height: number; rotation?: number }): string => {
  const tilt = item.rotation ? `, tilted ${round(item.rotation)}°` : '';
  return `at ${round(item.x)},${round(item.y)} size ${round(item.width)}×${round(item.height)}${tilt}`;
};

const describePhoto = (doc: CollageDoc, photo: CollagePhotoItem, info: PhotoInfo | undefined): string => {
  const name = info ? `${info.video ? 'video ' : ''}${info.name}${info.dateTaken ? ` (${info.dateTaken})` : ''}` : 'a photo no longer in the albums';
  const details = [
    box(photo),
    photo.crop
      ? `showing ${percent(photo.crop.width)}×${percent(photo.crop.height)} from ${percent(photo.crop.x)},${percent(photo.crop.y)}`
      : null,
    photo.orientation ? `picture turned ${photo.orientation}°` : null,
    photoHasFrame(doc, photo) ? 'framed' : null,
    photo.caption ? `caption "${photo.caption}"` : null
  ].filter(Boolean);
  return `${name}, ${details.join(', ')}  [photo ${photo.photoId}]`;
};

const describeOverlay = (item: CollageTextItem): string => {
  if (item.kind === 'sticker') return `sticker ${item.text}, ${box(item)}`;
  if (item.kind === 'shape') {
    const outline = item.outline ? `, outlined ${item.outline}` : '';
    return `${item.shape ?? 'shape'} shape in ${item.color}${outline}, ${box(item)}`;
  }
  const style = [
    fontById(item.fontFamily).label,
    `${round(item.fontSize)}px`,
    item.bold === false ? 'regular' : 'bold',
    item.italic ? 'italic' : null,
    item.color,
    item.align && item.align !== 'center' ? `${item.align}-aligned` : null,
    item.background ? `on ${item.background}` : null,
    item.outline ? `outlined ${item.outline}` : null,
    item.shadow ? 'shadow' : null
  ].filter(Boolean);
  return `text "${item.text}" in ${style.join(' ')}, ${box(item)}`;
};

/** Every item, bottom to top, under the short names the tools take. */
export const describeLayout = (doc: CollageDoc, photos: Map<string, PhotoInfo>): string[] => {
  const ids = shortIdsOf(doc);
  const lines: string[] = [];
  lines.push(doc.photos.length ? 'Photos, bottom to top:' : 'No photos yet.');
  for (const photo of doc.photos) lines.push(`  ${ids.get(photo.id)}  ${describePhoto(doc, photo, photos.get(photo.photoId))}`);
  if (doc.texts.length) {
    lines.push('Texts, stickers and shapes, bottom to top (always above the photos):');
    for (const item of doc.texts) lines.push(`  ${ids.get(item.id)}  ${describeOverlay(item)}`);
  }
  return lines;
};

/** The settings a collage "like this one" copies. */
export const describeSettings = (doc: CollageDoc): string => {
  const frames = doc.frameEnabled ? `frames on, in ${doc.frameColor}` : 'frames off';
  return `${doc.canvas.width}×${doc.canvas.height}, background ${doc.background}, ${frames}`;
};

/** How much of a photo shows when it fills a box of another shape: 1 is all of it. */
const shareShown = (imageAspect: number, boxAspect: number): number =>
  Math.min(imageAspect / boxAspect, boxAspect / imageAspect);

/** Rough lines a text wraps to, at an average character width. Close enough to say "may not fit". */
const estimatedHeight = (item: CollageTextItem): number => {
  const perLine = Math.max(1, Math.floor(item.width / (item.fontSize * 0.55)));
  const lines = item.text.split('\n').reduce((sum, line) => sum + Math.max(1, Math.ceil(line.length / perLine)), 0);
  return lines * item.fontSize * TEXT_LINE_HEIGHT;
};

/** Below this a photo covering another reads as a mistake rather than a scattered style. */
const OVERLAP_SHARE = 0.15;

/**
 * What looks wrong, each as a sentence naming its items. Not every one is a
 * mistake: overlapping photos can be the style. They are listed so the model
 * looks, not so it fixes them blindly.
 */
export const checkCollage = (doc: CollageDoc, photos: Map<string, PhotoInfo>): string[] => {
  const ids = shortIdsOf(doc);
  const problems: string[] = [];
  const name = (item: { id: string }) => ids.get(item.id)!;

  if (doc.photos.length === 0) problems.push('There are no photos on it yet.');

  for (const item of [...doc.photos, ...doc.texts]) {
    const outside = shareOutside(item, doc.canvas);
    if (outside >= 0.999) problems.push(`${name(item)} is entirely off the canvas.`);
    else if (outside > 0.02) problems.push(`${name(item)} hangs ${percent(outside)} off the edge of the canvas.`);
  }

  const seen = new Map<string, string>();
  for (const photo of doc.photos) {
    const info = photos.get(photo.photoId);
    if (!info) problems.push(`${name(photo)} shows a photo that is no longer in the collage's albums; it draws as a grey box.`);

    const first = seen.get(photo.photoId);
    if (first) problems.push(`${name(photo)} is the same photo as ${first}.`);
    else seen.set(photo.photoId, name(photo));

    if (photo.width < doc.canvas.width * 0.05 || photo.height < doc.canvas.height * 0.05) {
      problems.push(`${name(photo)} is very small (${round(photo.width)}×${round(photo.height)}).`);
    }

    // A crop decides what shows, so only an uncropped photo is judged by its shape.
    if (info?.aspect && !photo.crop && photo.width > 0 && photo.height > 0) {
      const aspect = isQuarterTurned(photo.orientation) ? 1 / info.aspect : info.aspect;
      const shown = shareShown(aspect, photo.width / photo.height);
      if (shown < 0.5) {
        const shape = aspect < 1 ? 'tall' : 'wide';
        problems.push(`${name(photo)} shows only ${percent(shown)} of its ${shape} photo; a box closer to its shape would show more.`);
      }
    }
  }

  for (let a = 0; a < doc.photos.length; a++) {
    for (let b = a + 1; b < doc.photos.length; b++) {
      const first = doc.photos[a]!;
      const second = doc.photos[b]!;
      const smaller = Math.min(first.width * first.height, second.width * second.height);
      const covered = smaller > 0 ? overlapArea(first, second) / smaller : 0;
      if (covered > OVERLAP_SHARE) {
        problems.push(`${name(second)} covers ${percent(covered)} of ${name(first)}${covered > 0.6 ? ', hiding most of it' : ''}.`);
      }
    }
  }

  const readable = doc.canvas.width / 80;
  for (const item of doc.texts) {
    if (item.kind) continue;
    if (!item.text.trim()) problems.push(`${name(item)} is an empty text.`);
    if (item.fontSize < readable) {
      problems.push(`${name(item)} is ${round(item.fontSize)}px, small to read on a ${doc.canvas.width} wide collage.`);
    }
    if (estimatedHeight(item) > item.height * 1.15) problems.push(`${name(item)}'s text may not fit its box; make it taller or the text smaller.`);
  }

  if (doc.photos.length > 0) {
    const covered = coveredShare(doc);
    if (covered < 0.4) problems.push(`Only ${percent(covered)} of the canvas is covered; it may look empty.`);
  }

  return problems;
};

/** The share of the canvas under some item, sampled on a grid. */
const coveredShare = (doc: CollageDoc): number => {
  const columns = 32;
  const rows = 18;
  const areas = [...doc.photos, ...doc.texts].map(boundsOf);
  let hit = 0;
  for (let row = 0; row < rows; row++) {
    for (let column = 0; column < columns; column++) {
      const x = ((column + 0.5) / columns) * doc.canvas.width;
      const y = ((row + 0.5) / rows) * doc.canvas.height;
      if (areas.some((area) => x >= area.left && x <= area.right && y >= area.top && y <= area.bottom)) hit++;
    }
  }
  return hit / (columns * rows);
};

/** Who made it, and so whether this assistant may change it. */
export const describeMaker = (collage: Collage): string =>
  collage.madeBy
    ? `Made by ${collage.madeBy.label}, so you can change it.`
    : 'Made by a person, so you cannot change it. To rework it, make a new collage like it.';

/** The whole description get_collage and update_collage answer with. */
export const describeCollage = (
  collage: Collage,
  doc: CollageDoc,
  photos: Map<string, PhotoInfo>,
  albumNames: string[]
): string => {
  const problems = checkCollage(doc, photos);
  return [
    `"${collage.title}" (id ${collage._id}): ${describeSettings(doc)}.`,
    describeMaker(collage),
    `Photos come from ${albumNames.length ? albumNames.join(', ') : 'its albums'}; ${photos.size} to choose from.`,
    ...describeLayout(doc, photos),
    problems.length ? 'Worth a look:' : 'Nothing looks wrong.',
    ...problems.map((problem) => `  - ${problem}`)
  ].join('\n');
};
