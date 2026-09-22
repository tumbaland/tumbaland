import { brand, surface } from '@tumbaland/frontend-core';

/**
 * The chat themes. chat-service only stores a theme's id; how it looks lives
 * here, so a theme can be restyled without touching the service.
 *
 * All light on purpose. The other person's bubbles stay white and the muted
 * text (times, "Seen", system lines) stays grey, and both have to stay
 * readable on every background. Each bubble colour clears AA against white
 * text, and the header's grey and accent clear AA against its tint.
 */
export interface ChatTheme {
  id: string;
  name: string;
  /** Your own bubbles, and the send button. */
  bubble: string;
  /** Behind the thread. */
  background: string;
  /**
   * The bar with the other person's name: a deeper tint of the background, so
   * it reads as the top of this chat rather than as part of the page.
   */
  header: string;
  /** "typing…" on that bar. The bubble colour, except where it would be too light there. */
  headerAccent: string;
}

export const CHAT_THEMES: ChatTheme[] = [
  {
    id: 'classic',
    name: 'Classic',
    bubble: brand.pinkInk,
    background: surface.default,
    header: '#f9e3f0',
    // pinkInk is 3.9:1 on this tint; the deeper pink is 5.2:1.
    headerAccent: brand.pinkInkDeep
  },
  {
    id: 'ocean',
    name: 'Ocean',
    bubble: '#1d4ed8',
    background: 'linear-gradient(160deg, #eff6ff 0%, #e0f2fe 100%)',
    header: '#dbeafe',
    headerAccent: '#1d4ed8'
  },
  {
    id: 'forest',
    name: 'Forest',
    bubble: '#15803d',
    background: 'linear-gradient(160deg, #f0fdf4 0%, #ecfccb 100%)',
    header: '#dcfce7',
    headerAccent: '#15803d'
  },
  {
    id: 'sunset',
    name: 'Sunset',
    bubble: '#c2410c',
    background: 'linear-gradient(160deg, #fff7ed 0%, #ffe4e6 100%)',
    header: '#ffedd5',
    headerAccent: '#c2410c'
  },
  {
    id: 'lavender',
    name: 'Lavender',
    bubble: '#7c3aed',
    background: 'linear-gradient(160deg, #f5f3ff 0%, #fce7f3 100%)',
    header: '#ede9fe',
    headerAccent: '#7c3aed'
  },
  {
    id: 'graphite',
    name: 'Graphite',
    bubble: '#334155',
    background: 'linear-gradient(160deg, #f8fafc 0%, #e2e8f0 100%)',
    header: '#e2e8f0',
    headerAccent: '#334155'
  }
];

/** A theme by id, falling back to Classic for one this version does not know. */
export const themeById = (id: string | undefined): ChatTheme =>
  CHAT_THEMES.find((theme) => theme.id === id) ?? CHAT_THEMES[0]!;
