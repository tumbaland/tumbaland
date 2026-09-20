import { createTheme, type Theme, type ThemeOptions } from '@mui/material/styles';
import { brand, gutter, ink, PHONE, surface, TOUCH_TARGET } from './tokens';

const FONT_STACK = '"Inter", system-ui, -apple-system, "Segoe UI", Roboto, "Helvetica Neue", Arial, sans-serif';

/**
 * The one theme every Tumbaland front renders with.
 *
 * Before this, `createConfigProvider` offered an opt-in theme that set exactly
 * one value — the page background — so seven of the eight fronts were drawing
 * MUI's factory blue and Roboto underneath a pink product. Crossing from the
 * shell into a framed module changed the typeface, the blue and the shape of
 * every button, which is the seam the iframe layout was otherwise hiding well.
 *
 * `shape.borderRadius` stays MUI's 4px unit deliberately: pages across the
 * apps write radii as theme multiples (`borderRadius: 2`), and a larger unit
 * silently turns all of those into pills. Components get their rounder corners
 * individually below.
 *
 * Most of what follows is there for phones. The fronts are used on one far
 * more than on a desktop, and MUI's defaults are tuned the other way: 36px
 * buttons, 14px inputs that make iOS zoom the page on focus, dialogs that keep
 * desktop margins, tab strips that overflow rather than scroll.
 */
export function createTumbalandTheme(overrides: ThemeOptions = {}): Theme {
  return createTheme(
    {
      palette: {
        primary: {
          main: brand.pinkInk,
          light: brand.pink,
          dark: brand.pinkInkDeep,
          contrastText: '#ffffff'
        },
        secondary: {
          main: brand.violetInk,
          light: brand.violet,
          dark: '#6d28d9',
          contrastText: '#ffffff'
        },
        success: { main: '#15803d' },
        warning: { main: '#b45309' },
        error: { main: '#dc2626' },
        info: { main: '#0369a1' },
        background: { default: surface.default, paper: surface.paper },
        text: { primary: ink.strong, secondary: ink.body, disabled: ink.faint },
        divider: surface.divider
      },

      typography: {
        fontFamily: FONT_STACK,
        h1: { fontWeight: 800, letterSpacing: '-0.02em' },
        h2: { fontWeight: 700, letterSpacing: '-0.02em' },
        h3: { fontWeight: 700, letterSpacing: '-0.02em' },
        // Page titles. MUI's 2.125rem h4 filled a phone's width with two words.
        h4: { fontWeight: 700, letterSpacing: '-0.02em', fontSize: '1.75rem', [PHONE]: { fontSize: '1.375rem' } },
        h5: { fontWeight: 700, letterSpacing: '-0.01em', [PHONE]: { fontSize: '1.15rem' } },
        h6: { fontWeight: 600, [PHONE]: { fontSize: '1rem' } },
        subtitle1: { fontWeight: 600 },
        subtitle2: { fontWeight: 600 },
        button: { textTransform: 'none', fontWeight: 600 }
      },

      shape: { borderRadius: 4 },

      components: {
        MuiCssBaseline: {
          styleOverrides: {
            html: {
              // Landscape on iOS otherwise inflates body text on its own.
              WebkitTextSizeAdjust: '100%'
            },
            body: {
              WebkitFontSmoothing: 'antialiased',
              MozOsxFontSmoothing: 'grayscale',
              // One wide row — a table, a chart, a strip of thumbnails — used
              // to make the whole page slide sideways under a thumb. Pages
              // that genuinely scroll horizontally do it in their own box.
              overflowX: 'hidden'
            },
            // Was an inline <style> block in shell-front's Layout, so only the
            // shell had it and the framed modules showed platform scrollbars.
            '*::-webkit-scrollbar': { width: 8, height: 8 },
            '*::-webkit-scrollbar-track': { background: 'transparent' },
            '*::-webkit-scrollbar-thumb': { background: 'rgba(139,92,246,0.22)', borderRadius: 4 },
            '*::-webkit-scrollbar-thumb:hover': { background: 'rgba(139,92,246,0.42)' }
          }
        },

        MuiContainer: {
          styleOverrides: {
            root: {
              paddingLeft: 16,
              paddingRight: 16,
              '@media (min-width:600px)': { paddingLeft: 24, paddingRight: 24 }
            }
          }
        },

        MuiButton: {
          defaultProps: { disableElevation: true },
          styleOverrides: {
            root: { borderRadius: 12, [PHONE]: { minHeight: TOUCH_TARGET } },
            sizeSmall: { borderRadius: 10, [PHONE]: { minHeight: 36 } },
            sizeLarge: { paddingInline: 24, minHeight: 48 }
          }
        },

        MuiIconButton: {
          styleOverrides: {
            root: { [PHONE]: { minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET } },
            sizeSmall: { [PHONE]: { minWidth: 36, minHeight: 36 } }
          }
        },

        MuiFab: {
          styleOverrides: { root: { textTransform: 'none', fontWeight: 600 } }
        },

        MuiPaper: {
          styleOverrides: {
            root: { backgroundImage: 'none' },
            rounded: { borderRadius: 14 },
            outlined: { borderColor: surface.divider }
          }
        },

        MuiCard: {
          styleOverrides: {
            root: {
              borderRadius: 18,
              border: `1px solid ${surface.divider}`,
              boxShadow: '0 10px 30px -24px rgba(88,28,135,0.45)'
            }
          }
        },

        MuiCardContent: {
          // 24px of padding on each side of a 360px screen is a quarter of it.
          styleOverrides: { root: { [PHONE]: { padding: 16, '&:last-child': { paddingBottom: 16 } } } }
        },

        // Near-fullscreen on a phone: MUI keeps a desktop's margins, which
        // leaves a form squeezed into the middle with nothing gained.
        MuiDialog: {
          styleOverrides: {
            paper: {
              borderRadius: 20,
              [PHONE]: {
                margin: 12,
                width: 'calc(100% - 24px)',
                maxWidth: 'calc(100% - 24px)',
                maxHeight: 'calc(100% - 24px)',
                borderRadius: 18
              }
            }
          }
        },

        MuiDialogTitle: {
          styleOverrides: { root: { fontWeight: 700, [PHONE]: { padding: '16px 16px 8px' } } }
        },
        MuiDialogContent: {
          styleOverrides: { root: { [PHONE]: { padding: '8px 16px' } } }
        },
        MuiDialogActions: {
          styleOverrides: { root: { padding: 16, gap: 8 } }
        },

        MuiMenu: {
          styleOverrides: { paper: { borderRadius: 14 } }
        },
        MuiMenuItem: {
          styleOverrides: { root: { [PHONE]: { minHeight: TOUCH_TARGET } } }
        },
        MuiListItemButton: {
          styleOverrides: { root: { borderRadius: 10, [PHONE]: { minHeight: TOUCH_TARGET } } }
        },

        MuiOutlinedInput: {
          styleOverrides: {
            root: { borderRadius: 12, backgroundColor: surface.paper },
            // 16px is the threshold below which iOS Safari zooms the page in
            // when a field takes focus, and then leaves it zoomed.
            input: { [PHONE]: { fontSize: 16 } }
          }
        },
        MuiInputBase: {
          styleOverrides: { input: { [PHONE]: { fontSize: 16 } } }
        },
        MuiSelect: {
          styleOverrides: { select: { [PHONE]: { fontSize: 16 } } }
        },

        MuiAlert: {
          styleOverrides: { root: { borderRadius: 12 } }
        },

        MuiChip: {
          styleOverrides: { root: { fontWeight: 500, borderRadius: 8 } }
        },

        // Tab strips are the most common cause of a page wider than the phone
        // it is on. Scrolling is the right default; a page that wants fixed
        // tabs still passes `variant` itself.
        MuiTabs: {
          defaultProps: { variant: 'scrollable', scrollButtons: 'auto', allowScrollButtonsMobile: true },
          styleOverrides: { root: { minHeight: 44 } }
        },
        MuiTab: {
          styleOverrides: {
            root: {
              textTransform: 'none',
              fontWeight: 600,
              minHeight: 44,
              [PHONE]: { minWidth: 'auto', paddingInline: 12, fontSize: '0.875rem' }
            }
          }
        },

        MuiTableCell: {
          styleOverrides: {
            root: {
              borderColor: surface.divider,
              [PHONE]: { padding: '8px 10px', fontSize: '0.8125rem' }
            },
            head: {
              backgroundColor: surface.sunken,
              color: ink.body,
              fontSize: '0.75rem',
              fontWeight: 700,
              letterSpacing: '0.04em',
              textTransform: 'uppercase',
              whiteSpace: 'nowrap'
            }
          }
        },

        MuiLinearProgress: {
          styleOverrides: { root: { borderRadius: 999 }, bar: { borderRadius: 999 } }
        },

        MuiTooltip: {
          // A tooltip is invisible on a touch screen, so anything that needs
          // one also needs a visible label. Kept legible where it does show.
          styleOverrides: { tooltip: { fontSize: '0.75rem', borderRadius: 8, padding: '6px 10px' } }
        },

        MuiSwitch: {
          styleOverrides: { root: { [PHONE]: { marginInline: 4 } } }
        },

        MuiBottomNavigationAction: {
          styleOverrides: { root: { minWidth: 0, [PHONE]: { minHeight: TOUCH_TARGET } } }
        }
      }
    },
    overrides
  );
}

/**
 * The colours named outside a React tree: `theme-color` in each index.html,
 * the manifest, the offline page.
 */
export const TUMBALAND_COLORS = {
  brand: brand.pinkInk,
  themeColor: '#fdf2fa',
  background: surface.default
} as const;

/** Built once at module scope — a theme rebuilt per render remounts styles. */
export const tumbalandTheme = createTumbalandTheme();

export const gutterSx = { px: gutter } as const;
