import { readdirSync } from 'fs';
import { dirname, join } from 'path';
import { GlobalFonts } from '@napi-rs/canvas';
import { COLLAGE_FONTS } from '@tumbaland/collage-core';

/**
 * The collage fonts, for drawing on the server.
 *
 * The browser gets them from Google Fonts; the server has no network font
 * loading and the image has no system fonts at all, so each one comes from its
 * @expo-google-fonts package, installed like any other dependency. Without
 * them a preview would draw every text in nothing: Skia has nothing to fall
 * back to.
 *
 * Whole font files, not @fontsource's: those split a font into one file per
 * alphabet, and the canvas takes only the first file it is given for a family,
 * so "õhtu" drew and the š and ž of the next file came out as boxes.
 */

/** The @expo-google-fonts package for each font the editor offers, by its id there. */
export const FONT_PACKAGES: Record<string, string> = {
  sans: 'inter',
  serif: 'playfair-display',
  hand: 'caveat',
  script: 'dancing-script',
  marker: 'permanent-marker',
  poster: 'bebas-neue',
  retro: 'pacifico',
  typewriter: 'special-elite'
};

/** The weights the editor draws in, regular and bold, upright and italic where a font has them. */
const WEIGHTS = /^(400Regular|700Bold)(_Italic)?$/;

/** The first family a CSS font-family list names, which is the one the page loads. */
export const primaryFamily = (family: string): string => family.split(',')[0]!.trim().replace(/^"|"$/g, '');

/** Each package keeps one folder per weight, named like `700Bold_Italic`, holding the .ttf. */
const register = (pkg: string, family: string): number => {
  const root = dirname(require.resolve(`@expo-google-fonts/${pkg}/package.json`));
  return readdirSync(root, { withFileTypes: true })
    .filter((entry) => entry.isDirectory() && WEIGHTS.test(entry.name))
    .flatMap((entry) =>
      readdirSync(join(root, entry.name))
        .filter((file) => file.endsWith('.ttf'))
        .map((file) => join(root, entry.name, file))
    )
    .filter((file) => GlobalFonts.registerFromPath(file, family)).length;
};

let registered = false;

/** Registers every collage font with the canvas, once per process. */
export const registerCollageFonts = (): void => {
  if (registered) return;

  for (const font of COLLAGE_FONTS) {
    register(FONT_PACKAGES[font.id]!, primaryFamily(font.family));
  }
  // Captions are drawn in plain `sans-serif`, which on a machine with no fonts
  // names nothing. The app's own sans stands in.
  register('inter', 'sans-serif');
  register('noto-color-emoji', 'Noto Color Emoji');
  // Only once all of them are in: a throw part way leaves it to try again,
  // rather than every later preview drawing with whatever made it in.
  registered = true;
};
