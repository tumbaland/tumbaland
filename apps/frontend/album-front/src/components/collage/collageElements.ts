import type { CSSProperties } from 'react';
import { CollageShape, CollageTextItem, DEFAULT_FONT } from './collageDoc';

/**
 * How text, stickers and shapes look, in one place for the three things that
 * draw them: the editor's canvas (CSS), the collage card's preview, and the
 * PNG and video export (canvas 2D). Kept together so an export matches what
 * was on screen.
 */

export interface CollageFont {
  id: string;
  label: string;
  /** CSS font-family, with fallbacks for while the web font loads. */
  family: string;
  /** Google Fonts `family=` value; absent for a font the page already has. */
  google?: string;
}

export const COLLAGE_FONTS: CollageFont[] = [
  {
    id: DEFAULT_FONT,
    label: 'Clean',
    family: 'Inter, system-ui, sans-serif',
    google: 'Inter:ital,wght@0,400;0,700;1,400;1,700'
  },
  {
    id: 'serif',
    label: 'Classic',
    family: '"Playfair Display", Georgia, serif',
    google: 'Playfair+Display:ital,wght@0,400;0,700;1,400;1,700'
  },
  { id: 'hand', label: 'Handwritten', family: '"Caveat", cursive', google: 'Caveat:wght@400;700' },
  { id: 'script', label: 'Script', family: '"Dancing Script", cursive', google: 'Dancing+Script:wght@400;700' },
  { id: 'marker', label: 'Marker', family: '"Permanent Marker", cursive', google: 'Permanent+Marker' },
  { id: 'poster', label: 'Poster', family: '"Bebas Neue", Impact, sans-serif', google: 'Bebas+Neue' },
  { id: 'retro', label: 'Retro', family: '"Pacifico", cursive', google: 'Pacifico' },
  {
    id: 'typewriter',
    label: 'Typewriter',
    family: '"Special Elite", "Courier New", monospace',
    google: 'Special+Elite'
  }
];

const EMOJI_FAMILY = '"Apple Color Emoji", "Segoe UI Emoji", "Noto Color Emoji", sans-serif';

export const fontById = (id?: string): CollageFont => COLLAGE_FONTS.find((font) => font.id === id) ?? COLLAGE_FONTS[0]!;

const FONTS_LINK_ID = 'tumbaland-collage-fonts';

/**
 * Adds the collage fonts to the page, once. At runtime rather than in
 * index.html: under the shell, album-front's own index.html is never loaded.
 */
export const ensureCollageFonts = (): void => {
  if (typeof document === 'undefined' || document.getElementById(FONTS_LINK_ID)) return;
  const families = COLLAGE_FONTS.flatMap((font) => (font.google ? [`family=${font.google}`] : [])).join('&');
  const link = document.createElement('link');
  link.id = FONTS_LINK_ID;
  link.rel = 'stylesheet';
  link.href = `https://fonts.googleapis.com/css2?${families}&display=swap`;
  document.head.appendChild(link);
};

/**
 * Waits for the fonts these items use, so an export does not draw in the
 * fallback font because the real one was still on its way. Gives up after a
 * few seconds: a slightly different font beats no export.
 */
export const loadFontsFor = async (items: CollageTextItem[]): Promise<void> => {
  if (typeof document === 'undefined' || !document.fonts?.load) return;
  ensureCollageFonts();
  const specs = new Set<string>();
  for (const item of items) {
    if (item.kind === 'shape' || item.kind === 'sticker') continue;
    specs.add(`${fontShorthand(item, 32)}`);
  }
  const loads = Promise.all([...specs].map((spec) => document.fonts.load(spec).catch(() => undefined)));
  await Promise.race([loads, new Promise((resolve) => setTimeout(resolve, 3000))]);
};

/** A sticker's emoji fills its box; its `fontSize` is not used. */
export const stickerFontSize = (item: Pick<CollageTextItem, 'width' | 'height'>): number =>
  Math.min(item.width, item.height) * 0.8;

/** Stroke width for outlined text; only the outer half shows, the fill covers the rest. */
export const outlineWidth = (fontSize: number): number => Math.max(2, fontSize * 0.12);

/** Stroke width round a shape, in canvas units whatever the shape's size. */
export const SHAPE_OUTLINE_WIDTH = 6;

export const TEXT_LINE_HEIGHT = 1.15;
export const TEXT_SHADOW = { color: 'rgba(0,0,0,0.45)', blur: 8, offsetY: 3 };

/** Room between a label's edge and its text. */
export const labelPadding = (item: Pick<CollageTextItem, 'background' | 'align' | 'fontSize'>): number =>
  item.background || item.align === 'left' || item.align === 'right' ? item.fontSize * 0.3 : 0;

/** The CSS `font` shorthand, which canvas 2D takes as is. */
export const fontShorthand = (item: CollageTextItem, size = item.fontSize): string => {
  if (item.kind === 'sticker') return `${size}px ${EMOJI_FAMILY}`;
  const style = item.italic ? 'italic ' : '';
  const weight = item.bold === false ? 400 : 700;
  return `${style}${weight} ${size}px ${fontById(item.fontFamily).family}`;
};

/** How the letters of a text or sticker look on the editor's canvas. */
export const textCss = (item: CollageTextItem): CSSProperties => {
  if (item.kind === 'sticker') {
    return { fontFamily: EMOJI_FAMILY, fontSize: stickerFontSize(item), lineHeight: 1, textAlign: 'center' };
  }
  return {
    fontFamily: fontById(item.fontFamily).family,
    fontWeight: item.bold === false ? 400 : 700,
    fontStyle: item.italic ? 'italic' : 'normal',
    fontSize: item.fontSize,
    lineHeight: TEXT_LINE_HEIGHT,
    color: item.color,
    textAlign: item.align ?? 'center',
    padding: `0 ${labelPadding(item)}px`,
    ...(item.outline
      ? { WebkitTextStroke: `${outlineWidth(item.fontSize)}px ${item.outline}`, paintOrder: 'stroke fill' }
      : {}),
    ...(item.shadow ? { textShadow: `0 ${TEXT_SHADOW.offsetY}px ${TEXT_SHADOW.blur}px ${TEXT_SHADOW.color}` } : {})
  };
};

/** Corner radius of a text's label. */
export const labelRadius = (item: Pick<CollageTextItem, 'fontSize'>): number => item.fontSize * 0.3;

const starPath = (): string => {
  const points: string[] = [];
  for (let i = 0; i < 10; i++) {
    const radius = i % 2 === 0 ? 50 : 20;
    const angle = (Math.PI / 5) * i - Math.PI / 2;
    points.push(`${(50 + radius * Math.cos(angle)).toFixed(2)} ${(54 + radius * Math.sin(angle)).toFixed(2)}`);
  }
  return `M${points.join('L')}Z`;
};

/** Each shape as an SVG path in a 100 x 100 box, stretched to the item's box when drawn. */
export const SHAPE_PATHS: Record<CollageShape, string> = {
  rectangle: 'M0 0H100V100H0Z',
  rounded: 'M16 0H84A16 16 0 0 1 100 16V84A16 16 0 0 1 84 100H16A16 16 0 0 1 0 84V16A16 16 0 0 1 16 0Z',
  circle: 'M50 0A50 50 0 1 1 50 100A50 50 0 1 1 50 0Z',
  heart: 'M50 94C50 94 2 63 2 31C2 15 14 4 28 4C38 4 46 10 50 19C54 10 62 4 72 4C86 4 98 15 98 31C98 63 50 94 50 94Z',
  star: starPath(),
  triangle: 'M50 2L98 98H2Z',
  arrow: 'M0 34H58V8L100 50L58 92V66H0Z'
};

export const SHAPE_LABELS: Record<CollageShape, string> = {
  rectangle: 'Rectangle',
  rounded: 'Rounded box',
  circle: 'Circle',
  heart: 'Heart',
  star: 'Star',
  triangle: 'Triangle',
  arrow: 'Arrow'
};

/** Stickers on offer: a short list of the ones a couple's collage reaches for. */
export const STICKERS = [
  '❤️',
  '💕',
  '😍',
  '🥰',
  '😘',
  '😂',
  '🥳',
  '😎',
  '🎉',
  '🎂',
  '🎁',
  '🎄',
  '💍',
  '👑',
  '🌹',
  '🌸',
  '🌞',
  '🌈',
  '⭐',
  '✨',
  '🔥',
  '💯',
  '👍',
  '🙌',
  '📸',
  '✈️',
  '🏖️',
  '🏔️',
  '🍕',
  '🍷',
  '☕',
  '🐶'
];

/** Splits text into the lines it wraps to in `maxWidth`, as the canvas in the editor wraps it. */
export const wrapLines = (ctx: CanvasRenderingContext2D, text: string, maxWidth: number): string[] => {
  const lines: string[] = [];
  for (const paragraph of text.split('\n')) {
    const words = paragraph.split(/(\s+)/);
    let line = '';
    for (const word of words) {
      const candidate = line + word;
      if (line.trim() && ctx.measureText(candidate).width > maxWidth) {
        lines.push(line.trimEnd());
        line = word.trimStart();
      } else {
        line = candidate;
      }
    }
    lines.push(line);
  }
  return lines;
};

const roundedRect = (ctx: CanvasRenderingContext2D, x: number, y: number, w: number, h: number, r: number) => {
  ctx.beginPath();
  if (typeof ctx.roundRect === 'function') ctx.roundRect(x, y, w, h, r);
  else ctx.rect(x, y, w, h);
};

/** Draws one text, sticker or shape where it sits on the canvas, rotation included. */
export const drawOverlayItem = (ctx: CanvasRenderingContext2D, item: CollageTextItem): void => {
  const { width: w, height: h } = item;
  ctx.save();
  ctx.translate(item.x + w / 2, item.y + h / 2);
  ctx.rotate(((item.rotation || 0) * Math.PI) / 180);

  if (item.kind === 'shape' && item.shape) {
    const path = new Path2D();
    path.addPath(
      new Path2D(SHAPE_PATHS[item.shape]),
      new DOMMatrix().translate(-w / 2, -h / 2).scale(w / 100, h / 100)
    );
    if (item.shadow) {
      ctx.shadowColor = TEXT_SHADOW.color;
      ctx.shadowBlur = TEXT_SHADOW.blur;
      ctx.shadowOffsetY = TEXT_SHADOW.offsetY;
    }
    ctx.fillStyle = item.color;
    ctx.fill(path);
    if (item.outline) {
      ctx.shadowColor = 'transparent';
      ctx.lineWidth = SHAPE_OUTLINE_WIDTH;
      ctx.lineJoin = 'round';
      ctx.strokeStyle = item.outline;
      ctx.stroke(path);
    }
    ctx.restore();
    return;
  }

  if (item.background && item.kind !== 'sticker') {
    ctx.fillStyle = item.background;
    roundedRect(ctx, -w / 2, -h / 2, w, h, labelRadius(item));
    ctx.fill();
  }

  const size = item.kind === 'sticker' ? stickerFontSize(item) : item.fontSize;
  ctx.font = fontShorthand(item, size);
  ctx.fillStyle = item.color;
  ctx.textBaseline = 'middle';
  const align = item.kind === 'sticker' ? 'center' : (item.align ?? 'center');
  ctx.textAlign = align;
  const pad = item.kind === 'sticker' ? 0 : labelPadding(item);
  const x = align === 'left' ? -w / 2 + pad : align === 'right' ? w / 2 - pad : 0;

  const lines = item.kind === 'sticker' ? [item.text] : wrapLines(ctx, item.text, Math.max(1, w - pad * 2));
  const lineHeight = size * (item.kind === 'sticker' ? 1 : TEXT_LINE_HEIGHT);
  let y = -((lines.length - 1) * lineHeight) / 2;

  if (item.shadow) {
    ctx.shadowColor = TEXT_SHADOW.color;
    ctx.shadowBlur = TEXT_SHADOW.blur;
    ctx.shadowOffsetY = TEXT_SHADOW.offsetY;
  }
  for (const line of lines) {
    if (item.outline && item.kind !== 'sticker') {
      ctx.lineWidth = outlineWidth(item.fontSize);
      ctx.lineJoin = 'round';
      ctx.strokeStyle = item.outline;
      ctx.strokeText(line, x, y);
    }
    ctx.fillText(line, x, y);
    y += lineHeight;
  }
  ctx.restore();
};
