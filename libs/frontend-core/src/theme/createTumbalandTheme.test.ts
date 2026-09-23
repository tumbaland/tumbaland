import { createTumbalandTheme, tumbalandTheme } from './createTumbalandTheme';
import { brand, ink, surface, moduleAccent, PHONE, schemeCssVars, schemes, TOUCH_TARGET } from './tokens';

/** WCAG relative luminance, so the palette's contrast claims are checked rather than trusted. */
function luminance(hex: string): number {
  const channels = [1, 3, 5]
    .map((i) => parseInt(hex.slice(i, i + 2), 16) / 255)
    .map((c) => (c <= 0.03928 ? c / 12.92 : Math.pow((c + 0.055) / 1.055, 2.4)));
  return 0.2126 * channels[0] + 0.7152 * channels[1] + 0.0722 * channels[2];
}

function contrast(a: string, b: string): number {
  const [light, dark] = [luminance(a), luminance(b)].sort((x, y) => y - x);
  return (light + 0.05) / (dark + 0.05);
}

describe('createTumbalandTheme', () => {
  it('uses the brand pink as primary rather than MUI’s default blue', () => {
    expect(tumbalandTheme.palette.primary.main).toBe(brand.pinkInk);
    expect(tumbalandTheme.palette.secondary.main).toBe(brand.violetInk);
  });

  it('leads with Inter, so the fronts match the shell', () => {
    expect(tumbalandTheme.typography.fontFamily).toMatch(/^"Inter"/);
  });

  it('keeps MUI’s 4px radius unit, which pages multiply', () => {
    // Raising this turns every `borderRadius: 2` across the apps into a pill.
    expect(tumbalandTheme.shape.borderRadius).toBe(4);
  });

  it('accepts overrides without losing the base palette', () => {
    // Colours are per scheme now, so an override names the scheme it is for.
    const theme = createTumbalandTheme({ colorSchemes: { dark: { palette: { background: { default: '#000000' } } } } });

    expect(theme.colorSchemes.dark!.palette.background.default).toBe('#000000');
    expect(theme.colorSchemes.dark!.palette.primary.main).toBe('#f062bd');
    expect(theme.palette.primary.main).toBe(brand.pinkInk);
  });

  describe('touch targets', () => {
    it('lifts buttons to the minimum tap size on phones', () => {
      const root = tumbalandTheme.components?.MuiButton?.styleOverrides?.root as Record<string, unknown>;

      expect(root[PHONE]).toEqual({ minHeight: TOUCH_TARGET });
    });

    it('lifts icon buttons too', () => {
      const root = tumbalandTheme.components?.MuiIconButton?.styleOverrides?.root as Record<string, unknown>;

      expect(root[PHONE]).toEqual({ minWidth: TOUCH_TARGET, minHeight: TOUCH_TARGET });
    });
  });

  it('sets phone inputs to 16px, below which iOS zooms the page on focus', () => {
    const input = tumbalandTheme.components?.MuiOutlinedInput?.styleOverrides?.input as Record<
      string,
      Record<string, unknown>
    >;

    expect(input[PHONE].fontSize).toBe(16);
  });

  it('scrolls tab strips by default rather than overflowing the screen', () => {
    expect(tumbalandTheme.components?.MuiTabs?.defaultProps).toMatchObject({
      variant: 'scrollable',
      allowScrollButtonsMobile: true
    });
  });

  it('gives dialogs near-full width on a phone', () => {
    const paper = tumbalandTheme.components?.MuiDialog?.styleOverrides?.paper as Record<
      string,
      Record<string, unknown>
    >;

    expect(paper[PHONE].width).toBe('calc(100% - 24px)');
  });
});

describe('palette contrast', () => {
  // `pink` is the identity and is only ever used for gradients and large fills;
  // `pinkInk` is the one anything readable uses. The pair only works if the
  // second actually clears AA, so it is asserted rather than assumed.
  it('gives the interactive pink AA contrast on white', () => {
    expect(contrast(brand.pinkInk, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('gives the interactive violet AA contrast on white', () => {
    expect(contrast(brand.violetInk, '#ffffff')).toBeGreaterThanOrEqual(4.5);
  });

  it('keeps every module accent readable as an active nav label', () => {
    // Money's old #22c55e sat at 2.3:1 here, which is the tab a phone in
    // daylight most needs to resolve.
    for (const [name, colour] of Object.entries(moduleAccent)) {
      expect(`${name}:${contrast(colour, '#ffffff').toFixed(2)}`).toBe(
        `${name}:${Math.max(contrast(colour, '#ffffff'), 4.5).toFixed(2)}`
      );
    }
  });

  it('keeps body and muted text readable on every surface, the page wash included', () => {
    // '#fdf2fa' is the pink top of `surface.page`, which is the lightest thing
    // text sits on and the one the old muted slate failed against.
    const { ink: light, surface: bg } = schemes.light;
    for (const shade of [light.strong, light.body, light.muted]) {
      for (const behind of [bg.paper, bg.sunken, bg.default, '#fdf2fa']) {
        expect(contrast(shade, behind)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('keeps the same text readable in dark, the top of its page glow included', () => {
    const { ink: dark, surface: bg } = schemes.dark;
    for (const shade of [dark.strong, dark.body, dark.muted]) {
      for (const behind of [bg.paper, bg.sunken, bg.default, '#2a1631']) {
        expect(contrast(shade, behind)).toBeGreaterThanOrEqual(4.5);
      }
    }
  });

  it('lightens the interactive colours for dark rather than reusing the light inks', () => {
    const dark = createTumbalandTheme().colorSchemes.dark!.palette;
    for (const colour of [dark.primary.main, dark.secondary.main]) {
      expect(contrast(colour, schemes.dark.surface.paper)).toBeGreaterThanOrEqual(4.5);
    }
    expect(contrast(dark.primary.main, dark.primary.contrastText)).toBeGreaterThanOrEqual(4.5);
  });
});

describe('light and dark', () => {
  it('points the tokens pages use at variables, so they follow the scheme', () => {
    expect(ink.muted).toBe('var(--tl-ink-muted)');
    expect(surface.chromeEdge).toBe('var(--tl-surface-chrome-edge)');
  });

  it('defines every variable in both schemes', () => {
    const light = schemeCssVars('light');
    const dark = schemeCssVars('dark');

    expect(Object.keys(dark).sort()).toEqual(Object.keys(light).sort());
    expect(light['--tl-ink-muted']).toBe(schemes.light.ink.muted);
    expect(dark['--tl-ink-muted']).toBe(schemes.dark.ink.muted);
  });

  it('switches on an attribute, so the choice can be made rather than only followed', () => {
    const theme = createTumbalandTheme();
    const baseline = theme.components?.MuiCssBaseline?.styleOverrides as Record<string, unknown>;

    expect(theme.colorSchemes.dark).toBeDefined();
    expect(baseline[':root[data-color-scheme="dark"], [data-color-scheme="dark"]']).toEqual(schemeCssVars('dark'));
    expect(baseline[':root, [data-color-scheme="light"]']).toEqual(schemeCssVars('light'));
  });
});
