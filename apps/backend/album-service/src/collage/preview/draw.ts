import { createCanvas, DOMMatrix, Image, Path2D, SKRSContext2D } from '@napi-rs/canvas';
import { boundsOf, CanvasEnv, CollageDoc, Frame, renderScene, shortIdsOf } from '@tumbaland/collage-core';
import { registerCollageFonts } from './fonts';

/**
 * Pictures of a collage and of an album, drawn on the server for an assistant
 * to look at. Nothing here loads anything: it is given decoded images, so it
 * can be tested with pictures made on the spot.
 */

const SERVER_ENV: CanvasEnv = { Path2D, DOMMatrix };

/** What a preview is encoded as. JPEG: a fraction of PNG's size, and only ever looked at. */
const JPEG_QUALITY = 82;

export const MIN_PREVIEW_WIDTH = 256;
export const MAX_PREVIEW_WIDTH = 2048;
/**
 * The tallest a preview is drawn. A collage can be a very narrow, very tall
 * canvas, and a preview scaled to a width would otherwise be that many rows of
 * pixels held in memory at once.
 */
export const MAX_PREVIEW_HEIGHT = 4096;

const LABEL_COLOUR = '#e91e63';

export interface DrawnImage {
  image: Buffer;
  mimeType: 'image/jpeg';
  width: number;
  height: number;
}

const frameOf = (picture: Image | undefined): Frame | undefined =>
  picture ? { source: picture, width: picture.width, height: picture.height } : undefined;

/** A small filled tag with white text, `size` canvas units tall, its top-left at (x, y). */
const drawTag = (ctx: SKRSContext2D, text: string, x: number, y: number, size: number): void => {
  ctx.font = `700 ${size * 0.7}px Inter`;
  const width = ctx.measureText(text).width + size * 0.6;
  ctx.fillStyle = LABEL_COLOUR;
  ctx.fillRect(x, y, width, size);
  ctx.fillStyle = '#ffffff';
  ctx.textAlign = 'left';
  ctx.textBaseline = 'middle';
  ctx.fillText(text, x + size * 0.3, y + size / 2);
};

/**
 * Each item's outline and short name (p1, t1, ...), drawn over the collage so
 * an assistant can say which thing it means. `scale` is output pixels per
 * canvas unit, so the labels come out the same size at any preview width.
 */
const drawOutlines = (ctx: SKRSContext2D, doc: CollageDoc, scale: number): void => {
  const ids = shortIdsOf(doc);
  const tag = 18 / scale;
  for (const item of [...doc.photos, ...doc.texts]) {
    ctx.save();
    ctx.translate(item.x + item.width / 2, item.y + item.height / 2);
    ctx.rotate(((item.rotation || 0) * Math.PI) / 180);
    ctx.strokeStyle = LABEL_COLOUR;
    ctx.lineWidth = 2 / scale;
    ctx.strokeRect(-item.width / 2, -item.height / 2, item.width, item.height);
    ctx.restore();

    // Upright, at the corner of what the item covers, so a tilted item's tag stays readable.
    const bounds = boundsOf(item);
    drawTag(ctx, ids.get(item.id)!, Math.max(0, bounds.left), Math.max(0, bounds.top), tag);
  }
};

/**
 * The collage as the editor's export draws it, `width` pixels wide. Photos
 * with no picture come out as grey boxes, which is how a missing photo looks
 * in the export too.
 */
export const drawCollagePreview = async (
  doc: CollageDoc,
  pictures: Map<string, Image>,
  options: { width: number; outline: boolean }
): Promise<DrawnImage> => {
  registerCollageFonts();
  const wanted = Math.round(Math.min(MAX_PREVIEW_WIDTH, Math.max(MIN_PREVIEW_WIDTH, options.width)));
  // Narrower than asked for when the canvas is tall enough to pass the height cap.
  const scale = Math.min(wanted / doc.canvas.width, MAX_PREVIEW_HEIGHT / doc.canvas.height);
  const width = Math.max(1, Math.round(doc.canvas.width * scale));
  const height = Math.max(1, Math.round(doc.canvas.height * scale));

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.scale(scale, scale);
  renderScene(ctx, doc, (photo) => frameOf(pictures.get(photo.photoId)), SERVER_ENV);
  if (options.outline) drawOutlines(ctx, doc, scale);

  return { image: await canvas.encode('jpeg', JPEG_QUALITY), mimeType: 'image/jpeg', width, height };
};

export interface SheetCell {
  /** the number written on it, which the list beside the picture uses too */
  n: number;
  picture?: Image;
}

export const SHEET_COLUMNS = 6;
const CELL = 200;
const GAP = 8;

/**
 * A numbered grid of pictures: an album's photos in one image, so an assistant
 * can see what they show and choose among them. Each picture is shown whole,
 * not cropped, since what is at its edges is part of what it is choosing.
 */
export const drawContactSheet = async (cells: SheetCell[]): Promise<DrawnImage> => {
  registerCollageFonts();
  const columns = Math.min(SHEET_COLUMNS, Math.max(1, cells.length));
  const rows = Math.max(1, Math.ceil(cells.length / SHEET_COLUMNS));
  const width = columns * CELL + (columns + 1) * GAP;
  const height = rows * CELL + (rows + 1) * GAP;

  const canvas = createCanvas(width, height);
  const ctx = canvas.getContext('2d');
  ctx.fillStyle = '#1e293b';
  ctx.fillRect(0, 0, width, height);

  cells.forEach((cell, index) => {
    const x = GAP + (index % SHEET_COLUMNS) * (CELL + GAP);
    const y = GAP + Math.floor(index / SHEET_COLUMNS) * (CELL + GAP);
    ctx.fillStyle = '#0f172a';
    ctx.fillRect(x, y, CELL, CELL);

    const picture = cell.picture;
    if (picture && picture.width > 0 && picture.height > 0) {
      const fit = Math.min(CELL / picture.width, CELL / picture.height);
      const w = picture.width * fit;
      const h = picture.height * fit;
      ctx.drawImage(picture, x + (CELL - w) / 2, y + (CELL - h) / 2, w, h);
    } else {
      ctx.fillStyle = '#94a3b8';
      ctx.font = '400 16px Inter';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText('no preview', x + CELL / 2, y + CELL / 2);
    }
    drawTag(ctx, String(cell.n), x, y, 28);
  });

  return { image: await canvas.encode('jpeg', JPEG_QUALITY), mimeType: 'image/jpeg', width, height };
};
