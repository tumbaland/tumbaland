import type { CSSProperties } from 'react';
import {
  COLLAGE_FONTS,
  CollageTextItem,
  EMOJI_FAMILY,
  fontById,
  fontShorthand,
  labelPadding,
  outlineWidth,
  stickerFontSize,
  TEXT_LINE_HEIGHT,
  TEXT_SHADOW
} from '@tumbaland/collage-core';

/**
 * The browser's side of how text, stickers and shapes look: loading the fonts
 * into the page, and the CSS the editor's canvas uses. The rest (the font list,
 * shapes, stickers and drawing on a canvas) is @tumbaland/collage-core's, where
 * the server's preview reads it too, so an export, a preview and the editor
 * agree.
 */

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
