import { Canvas2D, CanvasEnv } from './canvas';
import {
  CollageCrop,
  CollageDoc,
  CollagePhotoItem,
  isQuarterTurned,
  orientationTurns,
  photoHasFrame,
  sourceCrop
} from './doc';
import { drawOverlayItem } from './elements';

/**
 * Draws a whole collage onto a canvas 2D context, given the pictures.
 *
 * Loading the pictures is the caller's part, because it is the part that
 * differs: the browser loads <img> and <video> elements for an export, the
 * server decodes thumbnails for a preview. What is drawn, and where, is the
 * same for both, so the preview an assistant looks at is the export people
 * download.
 */

/** Space between a frame's edge and the picture inside it. */
export const FRAME_PADDING = 12;

/** Something drawable, with the size drawImage should sample it at. */
export interface Frame {
  source: unknown;
  width: number;
  height: number;
}

/**
 * drawImage with CSS object-fit: cover semantics, restricted to the photo's
 * crop region so the export matches what the canvas shows.
 */
export const drawCover = (
  ctx: Canvas2D,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
  crop?: CollageCrop
) => {
  const cropX = (crop?.x ?? 0) * frame.width;
  const cropY = (crop?.y ?? 0) * frame.height;
  const cropW = (crop?.width ?? 1) * frame.width;
  const cropH = (crop?.height ?? 1) * frame.height;

  const srcRatio = cropW / cropH;
  const destRatio = w / h;
  let sx = cropX;
  let sy = cropY;
  let sw = cropW;
  let sh = cropH;
  if (srcRatio > destRatio) {
    sw = sh * destRatio;
    sx = cropX + (cropW - sw) / 2;
  } else {
    sh = sw / destRatio;
    sy = cropY + (cropH - sh) / 2;
  }
  ctx.drawImage(frame.source, sx, sy, sw, sh, x, y, w, h);
};

/** How soft the copy behind a whole photo is, for a box of this size. */
export const wholePhotoBlur = (w: number, h: number): number => Math.round(Math.max(w, h) * 0.04);

/**
 * The whole picture inside the box, object-fit: contain, on a blurred copy of
 * itself drawn to cover the box, so the box keeps its size and nothing of the
 * photo is cut. The copy is clipped to the box, since the blur spills past it.
 */
export const drawContain = (ctx: Canvas2D, frame: Frame, x: number, y: number, w: number, h: number) => {
  ctx.save();
  ctx.beginPath();
  ctx.rect(x, y, w, h);
  ctx.clip();
  const blur = wholePhotoBlur(w, h);
  ctx.filter = `blur(${blur}px)`;
  // Drawn a little past the box, so the blur does not fade in from its edges.
  drawCover(ctx, frame, x - blur, y - blur, w + blur * 2, h + blur * 2);
  ctx.filter = 'none';
  ctx.restore();

  const scale = Math.min(w / frame.width, h / frame.height);
  const dw = frame.width * scale;
  const dh = frame.height * scale;
  ctx.drawImage(frame.source, 0, 0, frame.width, frame.height, x + (w - dw) / 2, y + (h - dh) / 2, dw, dh);
};

/** One photo into its box, by its fit. */
const drawFitted = (
  ctx: Canvas2D,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
  photo: CollagePhotoItem
) => {
  if (photo.fit === 'contain') drawContain(ctx, frame, x, y, w, h);
  else drawCover(ctx, frame, x, y, w, h, sourceCrop(photo));
};

/**
 * A photo drawn by its fit, carrying its quarter turns: the destination box is
 * turned about its centre and drawn on its side, so the picture lands upright
 * inside the item exactly as the canvas shows it.
 */
const drawOriented = (
  ctx: Canvas2D,
  frame: Frame,
  x: number,
  y: number,
  w: number,
  h: number,
  photo: CollagePhotoItem
) => {
  const turns = orientationTurns(photo.orientation);
  if (turns === 0) {
    drawFitted(ctx, frame, x, y, w, h, photo);
    return;
  }

  const turned = isQuarterTurned(photo.orientation);
  const width = turned ? h : w;
  const height = turned ? w : h;
  ctx.save();
  ctx.translate(x + w / 2, y + h / 2);
  ctx.rotate((turns * 90 * Math.PI) / 180);
  drawFitted(ctx, frame, -width / 2, -height / 2, width, height, photo);
  ctx.restore();
};

/**
 * The whole collage, once, with each photo drawn from whatever frame it has
 * now. A photo with no frame is drawn as a grey box, so a missing picture shows
 * as missing rather than as a gap. `env` is passed on for shapes (see
 * drawOverlayItem).
 */
export const renderScene = (
  ctx: Canvas2D,
  doc: CollageDoc,
  frameOf: (photo: CollagePhotoItem) => Frame | undefined,
  env?: CanvasEnv
) => {
  ctx.fillStyle = doc.background;
  ctx.fillRect(0, 0, doc.canvas.width, doc.canvas.height);

  for (const photo of doc.photos) {
    const frame = frameOf(photo);
    ctx.save();
    ctx.translate(photo.x + photo.width / 2, photo.y + photo.height / 2);
    ctx.rotate(((photo.rotation || 0) * Math.PI) / 180);
    const left = -photo.width / 2;
    const top = -photo.height / 2;

    const framed = photoHasFrame(doc, photo);
    let imgX = left;
    let imgY = top;
    let imgW = photo.width;
    let imgH = photo.height;
    if (framed) {
      ctx.shadowColor = 'rgba(0,0,0,0.35)';
      ctx.shadowBlur = 10;
      ctx.shadowOffsetY = 4;
      ctx.fillStyle = doc.frameColor;
      ctx.fillRect(left, top, photo.width, photo.height);
      ctx.shadowColor = 'transparent';
      imgX += FRAME_PADDING;
      imgY += FRAME_PADDING;
      imgW -= FRAME_PADDING * 2;
      imgH -= FRAME_PADDING * 2;
    }

    if (frame && frame.width > 0 && frame.height > 0) {
      drawOriented(ctx, frame, imgX, imgY, imgW, imgH, photo);
    } else {
      ctx.fillStyle = 'rgba(128,128,128,0.4)';
      ctx.fillRect(imgX, imgY, imgW, imgH);
    }

    if (photo.caption) {
      const barHeight = 26;
      ctx.fillStyle = 'rgba(255,255,255,0.92)';
      ctx.fillRect(imgX, imgY + imgH - barHeight, imgW, barHeight);
      ctx.fillStyle = '#111';
      ctx.font = '14px sans-serif';
      ctx.textAlign = 'center';
      ctx.textBaseline = 'middle';
      ctx.fillText(photo.caption, imgX + imgW / 2, imgY + imgH - barHeight / 2, imgW - 8);
    }
    ctx.restore();
  }

  for (const item of doc.texts) drawOverlayItem(ctx, item, env);
};
