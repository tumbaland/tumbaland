import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import { ColorModeSetting } from './ColorModeSetting';
import { COLOR_MODE_STORAGE_KEY, COLOR_SCHEME_STORAGE_KEY, tumbalandTheme } from '../../theme';

function renderSetting() {
  return render(
    <ThemeProvider
      theme={tumbalandTheme}
      modeStorageKey={COLOR_MODE_STORAGE_KEY}
      colorSchemeStorageKey={COLOR_SCHEME_STORAGE_KEY}
      noSsr
    >
      <meta name="theme-color" content="#fdf2fa" />
      <ColorModeSetting />
    </ThemeProvider>
  );
}

describe('ColorModeSetting', () => {
  beforeEach(() => {
    window.localStorage.removeItem(COLOR_MODE_STORAGE_KEY);
    document.documentElement.removeAttribute('data-color-scheme');
  });

  it('starts on Auto', () => {
    renderSetting();
    expect(screen.getByRole('button', { name: 'Auto' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches the whole document to dark and remembers it', async () => {
    renderSetting();

    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark'));
    expect(window.localStorage.getItem(COLOR_MODE_STORAGE_KEY)).toBe('dark');
    expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
  });

  it('switches back to light', async () => {
    renderSetting();

    await userEvent.click(screen.getByRole('button', { name: 'Dark' }));
    await userEvent.click(screen.getByRole('button', { name: 'Light' }));

    await waitFor(() => expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light'));
  });
});
