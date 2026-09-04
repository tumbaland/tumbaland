/**
 * One place the look is decided.
 *
 * Every colour below was already in the code — repeated as a literal across
 * fourteen files, which is why the signed-out page and the signed-in one had
 * quietly drifted apart and why "make it pinker" was a fourteen-file change.
 * Naming them once makes the palette a knob rather than a search-and-replace,
 * and it is what lets the two halves of the product read as one thing.
 */

/** The accent family. Pink leads; violet is what it resolves into. */
export const brand = {
  pink: '#ff1fae',
  pinkDeep: '#f01aa2',
  magenta: '#c026d3',
  violet: '#8b5cf6',
  violetDeep: '#7c4de8',
  purple: '#9333ea'
} as const;

/** Text, darkest to lightest. Slate rather than grey, to sit under the pink. */
export const ink = {
  strong: '#0f172a',
  body: '#475569',
  muted: '#64748b',
  faint: '#94a3b8'
} as const;

export const gradient = {
  brand: `linear-gradient(135deg, ${brand.pink} 0%, ${brand.violet} 100%)`,
  brandHover: `linear-gradient(135deg, ${brand.pinkDeep} 0%, ${brand.violetDeep} 100%)`,
  /** For a large tint behind a section, where the full-strength gradient shouts. */
  wash: `linear-gradient(135deg, ${brand.pink}14 0%, ${brand.violet}14 100%)`
} as const;

/**
 * The script wordmark, gradient-filled.
 *
 * Used by the landing hero and by the signed-in greeting. It was written out
 * twice with the same eight properties; a single definition is the only reason
 * the two can be trusted to match.
 */
export const wordmark = {
  fontFamily: '"Pacifico", cursive',
  lineHeight: 1.25,
  letterSpacing: 1,
  background: gradient.brand,
  backgroundClip: 'text',
  WebkitBackgroundClip: 'text',
  WebkitTextFillColor: 'transparent',
  filter: 'drop-shadow(0 4px 8px rgba(0,0,0,0.08))',
  pb: 1
} as const;

/**
 * The frosted card both pages are built from.
 *
 * Translucent on purpose: the cloud backdrop shows through, which is what ties
 * a card to the page rather than laying it on top.
 */
export const glass = {
  borderRadius: 3.5,
  background: 'rgba(255,255,255,0.62)',
  backdropFilter: 'blur(10px)',
  border: '1px solid rgba(255,255,255,0.7)',
  boxShadow: '0 10px 30px -22px rgba(31,38,135,0.5)'
} as const;

/** A card that responds to being pointed at. `accent` tints the lifted shadow. */
export const glassInteractive = (accent: string = brand.purple) =>
  ({
    ...glass,
    transition: 'transform .2s ease, box-shadow .2s ease',
    '&:hover': {
      transform: 'translateY(-3px)',
      boxShadow: `0 20px 38px -24px ${accent}cc`
    }
  }) as const;

/** The primary call to action, wherever one appears. */
export const brandButton = {
  textTransform: 'none',
  fontWeight: 600,
  borderRadius: 3,
  background: gradient.brand,
  boxShadow: `0 10px 28px -10px rgba(168,45,190,0.75)`,
  '&:hover': {
    background: gradient.brandHover,
    boxShadow: `0 12px 32px -10px rgba(168,45,190,0.9)`
  }
} as const;

/** Vertical rhythm, so sections on both pages breathe identically. */
export const section = {
  px: 2,
  py: { xs: 5, md: 7 }
} as const;
