import { useEffect, useId } from 'react';
import { Box, ToggleButton, ToggleButtonGroup, Typography, useColorScheme, useTheme, type Palette } from '@mui/material';
import BrightnessAutoOutlinedIcon from '@mui/icons-material/BrightnessAutoOutlined';
import LightModeOutlinedIcon from '@mui/icons-material/LightModeOutlined';
import DarkModeOutlinedIcon from '@mui/icons-material/DarkModeOutlined';
import { TUMBALAND_COLORS } from '../../theme';

export type ColorMode = 'system' | 'light' | 'dark';

const OPTIONS: { value: ColorMode; label: string; Icon: typeof LightModeOutlinedIcon }[] = [
  { value: 'system', label: 'Auto', Icon: BrightnessAutoOutlinedIcon },
  { value: 'light', label: 'Light', Icon: LightModeOutlinedIcon },
  { value: 'dark', label: 'Dark', Icon: DarkModeOutlinedIcon }
];

export interface ColorModeSettingProps {
  /** Shown above the buttons. Pass `null` where the surrounding row already says what it is. */
  label?: string | null;
  /** Tighter, for a menu rather than a settings page. */
  dense?: boolean;
}

/**
 * Auto, light or dark, for the whole of Tumbaland.
 *
 * The choice lives in the shell's theme provider, which every module is
 * federated into, so changing it here changes it everywhere at once. It is
 * per device on purpose: the same person may want dark on a phone at night and
 * light on a desk monitor.
 */
export function ColorModeSetting({ label = 'Appearance', dense = false }: ColorModeSettingProps) {
  const { mode, setMode } = useColorScheme();
  const labelId = useId();

  return (
    <Box>
      {label && (
        <Typography variant="subtitle2" component="p" id={labelId} sx={{ mb: 1 }}>
          {label}
        </Typography>
      )}
      <ToggleButtonGroup
        exclusive
        fullWidth
        size="small"
        value={mode ?? 'system'}
        onChange={(_, next: ColorMode | null) => next && setMode(next)}
        aria-labelledby={label ? labelId : undefined}
        aria-label={label ? undefined : 'Appearance'}
        sx={{ '& .MuiToggleButton-root': { gap: 0.75, textTransform: 'none', py: dense ? 0.5 : 0.75 } }}
      >
        {OPTIONS.map(({ value, label: text, Icon }) => (
          <ToggleButton key={value} value={value}>
            <Icon fontSize="small" />
            {text}
          </ToggleButton>
        ))}
      </ToggleButtonGroup>
    </Box>
  );
}

/**
 * Keeps the browser's own bar (`<meta name="theme-color">`) on the scheme that
 * is showing, which index.html can only guess at before the app loads.
 */
export function useThemeColorMeta() {
  const { colorScheme } = useColorScheme();

  useEffect(() => {
    if (!colorScheme) return;
    const meta = document.querySelector('meta[name="theme-color"]');
    meta?.setAttribute(
      'content',
      colorScheme === 'dark' ? TUMBALAND_COLORS.themeColorDark : TUMBALAND_COLORS.themeColor
    );
  }, [colorScheme]);
}

/**
 * The palette of the scheme that is showing, as real colour values.
 *
 * `theme.palette` is not it: with CSS variables the theme object is built once
 * and holds the light palette in both modes, while the page switches through
 * variables. That is fine in `sx`, which should say `'text.secondary'` anyway,
 * but anything that needs the colour itself — `alpha()`, an SVG attribute, a
 * chart series — reads the light value in dark. Use this there.
 */
export function useActivePalette(): Palette {
  const theme = useTheme();
  const { colorScheme } = useColorScheme();
  return (colorScheme && theme.colorSchemes?.[colorScheme]?.palette) || theme.palette;
}
