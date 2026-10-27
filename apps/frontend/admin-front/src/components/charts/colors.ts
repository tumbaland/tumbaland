import { DARK } from '@tumbaland/frontend-core';

/**
 * The one colour the charts draw data in.
 *
 * Every chart here is a single series, so identity is never in question and one
 * hue is enough: the Admin accent (the identity pink) in light, and a lighter
 * step of the same hue in dark. Both were run through the data-viz palette
 * validator against their surface (lightness band, chroma, contrast), as a
 * dark mode that is merely the light colour on a dark page is the usual way a
 * chart goes unreadable.
 */
export const VIZ_LIGHT = '#d61f92';
export const VIZ_DARK = '#e057ad';

/** Sets `--viz` for everything inside, in both colour schemes. */
export const vizVars = { '--viz': VIZ_LIGHT, [DARK]: { '--viz': VIZ_DARK } } as const;
