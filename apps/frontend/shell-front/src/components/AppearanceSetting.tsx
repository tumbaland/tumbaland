import type { KeyboardEvent } from 'react';
import MenuItem from '@mui/material/MenuItem';
import { useColorScheme } from '@mui/material/styles';
import { ColorModeSetting, type ColorMode } from '@tumbaland/frontend-core';

const ORDER: ColorMode[] = ['system', 'light', 'dark'];
const NAMES: Record<ColorMode, string> = { system: 'Auto', light: 'Light', dark: 'Dark' };

/**
 * Auto, light or dark, in the account menu, as the same three buttons the
 * rest of the app uses.
 *
 * A menu moves focus between its rows with the arrow keys and closes on Tab,
 * so buttons inside one cannot be reached from the keyboard. The row is a menu
 * item instead, so arrow down lands on it like any other, and left and right
 * step through the three. The buttons stay for the mouse and touch.
 */
export function AppearanceSetting() {
  const { mode, setMode } = useColorScheme();
  const current = mode ?? 'system';

  const onKeyDown = (event: KeyboardEvent<HTMLLIElement>) => {
    const step = event.key === 'ArrowRight' ? 1 : event.key === 'ArrowLeft' ? -1 : 0;
    if (!step) return;
    event.preventDefault();
    setMode(ORDER[(ORDER.indexOf(current) + step + ORDER.length) % ORDER.length]!);
  };

  return (
    <MenuItem
      disableRipple
      aria-label={`Appearance: ${NAMES[current]}. Left and right to change.`}
      onKeyDown={onKeyDown}
      sx={{
        display: 'block',
        borderRadius: 2,
        mx: 0.5,
        py: 1,
        cursor: 'default',
        // The buttons show their own hover; a second one behind them is noise.
        '&:hover': { backgroundColor: 'transparent' }
      }}
    >
      <ColorModeSetting label={null} dense />
    </MenuItem>
  );
}
