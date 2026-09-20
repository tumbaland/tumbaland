/**
 * One place the look is decided, for all eight fronts.
 *
 * This file used to live in shell-front, which meant the signed-in home page
 * was the only screen that knew what colour Tumbaland is. The other seven
 * frontends fell back to MUI's factory defaults — Roboto and `#1976d2` — and
 * then painted over them with literals, which is how three palettes ended up
 * in the product at once: the pink below, an indigo one in a dozen gradient
 * literals, and a sky-blue one in five copies of `AppLayout`.
 *
 * Naming the palette once, in the package every front already depends on,
 * makes it a knob rather than a search-and-replace.
 *
 * Two pinks, on purpose. `pink` is the identity — bright, and only ever used
 * for gradients and large decorative fills, where its 3.5:1 against white does
 * not matter. `pinkInk` is the one anything readable or clickable uses: the
 * same hue walked down to 4.7:1, which clears WCAG AA as text on white and as
 * a button behind white text. Reaching for `pink` on a label is the mistake
 * this pair exists to prevent.
 */

/** The accent family. Pink leads; violet is what it resolves into. */
export const brand = {
  /** Decorative only — gradient start, large fills. Fails AA as text. */
  pink: '#ff1fae',
  /** Decorative — the hover end of the gradient. */
  pinkDeep: '#f01aa2',
  /** The readable pink: text, icons, buttons, anything interactive. AA on white. */
  pinkInk: '#d61f92',
  /** Pressed and hover states for `pinkInk`. */
  pinkInkDeep: '#b3177a',
  magenta: '#c026d3',
  /** Decorative — gradient end. */
  violet: '#8b5cf6',
  violetDeep: '#7c4de8',
  /** The readable violet, for the same reason as `pinkInk`. AA on white. */
  violetInk: '#7c3aed',
  purple: '#9333ea'
} as const;

/** Text, darkest to lightest. Slate rather than grey, to sit under the pink. */
export const ink = {
  strong: '#0f172a',
  body: '#475569',
  // #64748b, the slate this was, reads 4.48:1 on the sunken surface and 4.36:1
  // on the pink top of the page wash — just under AA, on exactly the secondary
  // text that ends up there. Two steps darker clears it on every surface.
  muted: '#5f6d80',
  /** Decorative only — 2.6:1 on white. Never put words a reader needs in this. */
  faint: '#94a3b8'
} as const;

/**
 * Page and card backgrounds.
 *
 * `page` replaces the three different radial gradients the AppLayouts each had
 * (two sky-blue, one indigo). It is the pink-to-violet wash, so a module opened
 * inside the shell's iframe sits on the same backdrop as the shell around it —
 * which is what made the seam between them visible before.
 */
export const surface = {
  page: 'radial-gradient(circle at 50% 0%, #fdf2fa 0%, #f3edff 55%, #fbfcff 100%)',
  default: '#fbf9fd',
  paper: '#ffffff',
  /** Table heads, inset panels, anything one step back from `paper`. */
  sunken: '#faf7fc',
  divider: '#ece7f2'
} as const;

export const gradient = {
  brand: `linear-gradient(135deg, ${brand.pink} 0%, ${brand.violet} 100%)`,
  brandHover: `linear-gradient(135deg, ${brand.pinkDeep} 0%, ${brand.violetDeep} 100%)`,
  /** For a large tint behind a section, where the full-strength gradient shouts. */
  wash: `linear-gradient(135deg, ${brand.pink}14 0%, ${brand.violet}14 100%)`
} as const;

/**
 * Per-module accent, keyed by the shell's route.
 *
 * These were literals in shell-front's `apps.ts`, and four of the six failed
 * AA against white — Money's `#22c55e` sat at 2.3:1 as the active tab's label,
 * which on a phone in daylight is the one colour that has to read. Same hues,
 * walked down until they clear 4.5:1.
 */
export const moduleAccent = {
  home: brand.purple,
  journal: '#e11d48',
  album: '#2563eb',
  money: '#15803d',
  // The identity pink, in its readable form. This was `ink.strong`, which is
  // a text colour: as the tint behind Profile's current section it drew a grey
  // pill in the one place the product's own colour belongs.
  profile: brand.pinkInk,
  groups: brand.violetInk,
  billing: '#4f46e5'
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

/**
 * The frosted chrome around the content: the navigation rail, the tab bar under
 * it on phones, and the header bar above it.
 *
 * Named once because the three meet at a corner. They each had their own
 * rgba white and their own blur, so the seam between the rail and the bar it
 * touches was visible as a faint step in the tint.
 *
 * Not `glass`: that is the card, which is rounded and has a light border of its
 * own. A full-height rail with a 28px radius and a white outline is a card the
 * page happens to be next to.
 */
export const chrome = {
  background: 'rgba(255,255,255,0.78)',
  backdropFilter: 'blur(14px) saturate(150%)',
  WebkitBackdropFilter: 'blur(14px) saturate(150%)'
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

/**
 * The page gutter, as every layout and page should spell it.
 *
 * 16px on a phone is the narrowest that still keeps text off the screen's
 * curved edge; widening it past `sm` is what stops a card looking stranded on
 * a desktop. Pages that hardcoded `p: 3` lost 48px of a 360px screen to
 * nothing.
 */
export const gutter = { xs: 2, sm: 3 } as const;

/**
 * Minimum hit area for anything tapped, per the WCAG 2.2 target-size rule and
 * both platform guidelines. MUI's medium button is 36px tall, which is a miss
 * often enough to feel broken on a phone.
 */
export const TOUCH_TARGET = 44;

/** Below `sm` — the phone layout. Matches `theme.breakpoints.down('sm')`. */
export const PHONE = '@media (max-width:599.95px)';
