import { CollageDoc, photoHasFrame } from './collageDoc';
import { ResolvePhoto } from './CollageStage';

/**
 * Renders the collage document to a PNG blob using an offscreen canvas.
 * Requires the image host to allow anonymous CORS; if a fetched image
 * taints the canvas, the export rejects with a descriptive error.
 */

const FRAME_PADDING = 12;
const EXPORT_SCALE = 2; // render at 2x for print/share quality

const loadImage = (src: string): Promise<HTMLImageElement> =>
  new Promise((resolve, reject) => {
    const img = new Image();
    img.crossOrigin = 'anonymous';
    img.onload = () => resolve(img);
    img.onerror = () => reject(new Error('Failed to load image for export'));
    img.src = src;
  });

/** drawImage with CSS object-fit: cover semantics */
const drawCover = (
  ctx: CanvasRenderingContext2D,
  img: HTMLImageElement,
  x: number,
  y: number,
  w: number,
  h: number
) => {
  const srcRatio = img.naturalWidth / img.naturalHeight;
  const destRatio = w / h;
  let sx = 0;
  let sy = 0;
  let sw = img.naturalWidth;
  let sh = img.naturalHeight;
  if (srcRatio > destRatio) {
    sw = sh * destRatio;
    sx = (img.naturalWidth - sw) / 2;
  } else {
    sh = sw / destRatio;
    sy = (img.naturalHeight - sh) / 2;
  }
  ctx.drawImage(img, sx, sy, sw, sh, x, y, w, h);
};

export const exportCollageToPng = async (doc: CollageDoc, resolvePhoto: ResolvePhoto): Promise<Blob> => {
  const canvas = document.createElement('canvas');
  canvas.width = doc.canvas.width * EXPORT_SCALE;
  canvas.height = doc.canvas.height * EXPORT_SCALE;
  const ctx = canvas.getContext('2d');
  if (!ctx) throw new Error('Canvas is not supported in this browser');
  ctx.scale(EXPORT_SCALE, EXPORT_SCALE);

  ctx.fillStyle = doc.background;
  ctx.fillRect(0, 0, doc.canvas.width, doc.canvas.height);

  // Load all images up front (missing ones are skipped, not fatal)
  const images = new Map<string, HTMLImageElement>();
  await Promise.all(
    doc.photos.map(async (photo) => {
      const src = resolvePhoto(photo.photoId)?.src || resolvePhoto(photo.photoId)?.thumbSrc;
      if (!src) return;
      try {
        images.set(photo.id, await loadImage(src));
      } catch {
        // leave the photo out of the export rather than failing everything
      }
    })
  );

  for (const photo of doc.photos) {
    const img = images.get(photo.id);
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

    if (img) {
      drawCover(ctx, img, imgX, imgY, imgW, imgH);
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

  for (const text of doc.texts) {
    ctx.save();
    ctx.fillStyle = text.color;
    ctx.font = `700 ${text.fontSize}px sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    const lines = text.text.split('\n');
    const lineHeight = text.fontSize * 1.15;
    const totalHeight = lines.length * lineHeight;
    const centerX = text.x + text.width / 2;
    let y = text.y + text.height / 2 - totalHeight / 2 + lineHeight / 2;
    for (const line of lines) {
      ctx.fillText(line, centerX, y, text.width);
      y += lineHeight;
    }
    ctx.restore();
  }

  return new Promise<Blob>((resolve, reject) => {
    try {
      canvas.toBlob((blob) => {
        if (blob) resolve(blob);
        else reject(new Error('Export failed'));
      }, 'image/png');
    } catch {
      reject(
        new Error(
          'Export blocked by the image host (CORS). The collage still saves normally — use a screenshot as a fallback.'
        )
      );
    }
  });
};

export const downloadBlob = (blob: Blob, filename: string) => {
  const url = URL.createObjectURL(blob);
  const a = document.createElement('a');
  a.href = url;
  a.download = filename;
  a.click();
  URL.revokeObjectURL(url);
};
