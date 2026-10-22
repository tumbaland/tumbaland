import { brand, DARK, schemes, surface } from '@tumbaland/frontend-core';

/**
 * The chat themes. chat-service only stores a theme's id; how it looks lives
 * here, so a theme can be restyled without touching the service.
 *
 * A theme is the conversation's, shared by everyone in it. Light or dark is
 * each person's own, so every theme comes in both and the thread shows the one
 * that matches the rest of the app.
 *
 * Every variant is checked in themes.test.ts: white text on the bubble, the
 * header's grey and accent on its tint, and the muted grey (times, "Seen",
 * system lines) on both ends of the background.
 */
export interface ChatThemeVariant {
  /** Your own bubbles, and the send button. White text sits on it. */
  bubble: string;
  /** Behind the thread: a gradient between these two, top-left to bottom-right. */
  from: string;
  to: string;
  /**
   * The bar with the other person's name: a deeper tint of the background, so
   * it reads as the top of this chat rather than as part of the page.
   */
  header: string;
  /** "typing…" on that bar. The bubble colour, except where it would be too dark or light there. */
  headerAccent: string;
}

export interface ChatTheme {
  id: string;
  name: string;
  light: ChatThemeVariant;
  dark: ChatThemeVariant;
}

// The light backgrounds' lower stops are paler than their headers on purpose:
// the muted grey of a timestamp sits on them, and at the header's depth it
// fell just under AA (Graphite's old #e2e8f0 was 4.27:1).
export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    light: {
      bubble: brand.pinkInk,
      from: schemes.light.surface.default,
      to: schemes.light.surface.default,
      header: '#f9e3f0',
      // pinkInk is 3.9:1 on this tint; the deeper pink is 5.2:1.
      headerAccent: brand.pinkInkDeep
    },
    dark: { bubble: brand.pinkInk, from: '#1a1320', to: '#120f19', header: '#2a1826', headerAccent: '#f9a8d4' }
  },
  {
    id: 'ocean',
    name: 'Ocean',
    light: { bubble: '#1d4ed8', from: '#eff6ff', to: '#e0f2fe', header: '#dbeafe', headerAccent: '#1d4ed8' },
    dark: { bubble: '#2563eb', from: '#0e1830', to: '#0b1220', header: '#15233f', headerAccent: '#93c5fd' }
  },
  {
    id: 'forest',
    name: 'Forest',
    light: { bubble: '#15803d', from: '#f0fdf4', to: '#ecfccb', header: '#dcfce7', headerAccent: '#15803d' },
    dark: { bubble: '#15803d', from: '#0d1d14', to: '#0b1510', header: '#13291c', headerAccent: '#86efac' }
  },
  {
    id: 'sunset',
    name: 'Sunset',
    light: { bubble: '#c2410c', from: '#fff7ed', to: '#ffeced', header: '#ffedd5', headerAccent: '#c2410c' },
    dark: { bubble: '#c2410c', from: '#22140e', to: '#1c0f14', header: '#2e1a12', headerAccent: '#fdba74' }
  },
  {
    id: 'lavender',
    name: 'Lavender',
    light: { bubble: '#7c3aed', from: '#f5f3ff', to: '#fbecf6', header: '#ede9fe', headerAccent: '#7c3aed' },
    dark: { bubble: '#7c3aed', from: '#1a1430', to: '#1d1022', header: '#251c40', headerAccent: '#c4b5fd' }
  },
  {
    id: 'graphite',
    name: 'Graphite',
    light: { bubble: '#334155', from: '#f8fafc', to: '#eaeff4', header: '#e2e8f0', headerAccent: '#334155' },
    dark: { bubble: '#475569', from: '#151a22', to: '#0f131a', header: '#1e2530', headerAccent: '#cbd5e1' }
  },
  {
    id: 'rose',
    name: 'Rose',
    light: { bubble: '#be123c', from: '#fff1f2', to: '#ffeaec', header: '#ffe4e6', headerAccent: '#be123c' },
    dark: { bubble: '#be123c', from: '#220e14', to: '#1a0b10', header: '#31131c', headerAccent: '#fda4af' }
  },
  {
    id: 'teal',
    name: 'Teal',
    light: { bubble: '#0f766e', from: '#f0fdfa', to: '#ccfbf1', header: '#ccfbf1', headerAccent: '#0f766e' },
    dark: { bubble: '#0f766e', from: '#0b1d1c', to: '#091615', header: '#102a28', headerAccent: '#5eead4' }
  },
  {
    id: 'amber',
    name: 'Amber',
    // Amber's own 600 is 3.2:1 behind white text; this is the deepest step
    // that still reads as amber rather than brown.
    light: { bubble: '#b45309', from: '#fffbeb', to: '#fef3c7', header: '#fef3c7', headerAccent: '#92400e' },
    dark: { bubble: '#b45309', from: '#1f170a', to: '#171108', header: '#2c200d', headerAccent: '#fcd34d' }
  },
  {
    id: 'midnight',
    name: 'Midnight',
    light: { bubble: '#4338ca', from: '#eef2ff', to: '#ebeeff', header: '#e0e7ff', headerAccent: '#4338ca' },
    dark: { bubble: '#4f46e5', from: '#12132e', to: '#0c0d20', header: '#1b1d42', headerAccent: '#a5b4fc' }
  },
  {
    id: 'berry',
    name: 'Berry',
    light: { bubble: '#a21caf', from: '#fdf4ff', to: '#fae8ff', header: '#fae8ff', headerAccent: '#a21caf' },
    dark: { bubble: '#a21caf', from: '#1f0e22', to: '#170a19', header: '#2d1431', headerAccent: '#f0abfc' }
  },
  {
    id: 'cocoa',
    name: 'Cocoa',
    light: { bubble: '#7c4a2d', from: '#fdf8f3', to: '#f7eee4', header: '#f3e6d8', headerAccent: '#7c4a2d' },
    dark: { bubble: '#8b5a3c', from: '#1c150f', to: '#15100c', header: '#2a1f16', headerAccent: '#e7c3a3' }
  }
];

/** A theme by id, falling back to Classic for one this version does not know. */
export const themeById = (id: string | undefined): ChatTheme =>
  CHAT_THEMES.find((theme) => theme.id === id) ?? CHAT_THEMES[0]!;

const gradient = ({ from, to }: ChatThemeVariant) =>
  from === to ? from : `linear-gradient(160deg, ${from} 0%, ${to} 100%)`;

const variantVars = (variant: ChatThemeVariant) => ({
  '--chat-bubble': variant.bubble,
  '--chat-background': gradient(variant),
  '--chat-header': variant.header,
  '--chat-header-accent': variant.headerAccent
});

/**
 * A theme as CSS variables, light by default and dark under the app's dark
 * scheme. Spread into the `sx` of the box the thread (or a swatch) draws in;
 * everything inside reads `chatColors` rather than the theme itself.
 */
export const chatThemeVars = (theme: ChatTheme) => ({
  ...variantVars(theme.light),
  // The other person's bubbles. Paper on light; on dark, a lift of whatever
  // the theme's background is, which keeps them in its hue rather than grey.
  '--chat-other': surface.paper,
  [DARK]: { ...variantVars(theme.dark), '--chat-other': 'rgba(255,255,255,0.09)' }
});

/** What the thread's pieces are drawn in. Only meaningful inside `chatThemeVars`. */
export const chatColors = {
  bubble: 'var(--chat-bubble)',
  background: 'var(--chat-background)',
  header: 'var(--chat-header)',
  headerAccent: 'var(--chat-header-accent)',
  // With a fallback: a bubble drawn outside a thread (a test, a preview) still
  // needs a fill.
  other: `var(--chat-other, ${surface.paper})`,
  /**
   * Links in the other person's bubbles. The header's accent, which is already
   * checked for contrast on a pale tint in light and a dark one in dark.
   */
  link: `var(--chat-header-accent, ${brand.pinkInkDeep})`,
  /**
   * Around the small grey text that sits straight on the background (times,
   * "Seen", the album line). Nothing on a plain theme; a halo of the page's
   * own colour over a photo, where the veil alone leaves it hard to read.
   */
  metaHalo: 'var(--chat-meta-halo, none)'
} as const;
