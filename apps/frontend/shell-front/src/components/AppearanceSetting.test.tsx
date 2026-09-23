import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { ThemeProvider } from '@mui/material';
import MenuList from '@mui/material/MenuList';
import MenuItem from '@mui/material/MenuItem';
import { COLOR_MODE_STORAGE_KEY, COLOR_SCHEME_STORAGE_KEY, tumbalandTheme } from '@tumbaland/frontend-core';
import { AppearanceSetting } from './AppearanceSetting';

function renderInMenu() {
  return render(
    <ThemeProvider theme={tumbalandTheme} modeStorageKey={COLOR_MODE_STORAGE_KEY} colorSchemeStorageKey={COLOR_SCHEME_STORAGE_KEY} noSsr>
      <MenuList autoFocusItem>
        <MenuItem>Message notifications</MenuItem>
        <AppearanceSetting />
        <MenuItem>Sign out</MenuItem>
      </MenuList>
    </ThemeProvider>
  );
}

beforeEach(() => {
  localStorage.removeItem(COLOR_MODE_STORAGE_KEY);
  document.documentElement.removeAttribute('data-color-scheme');
});

it('shows the three buttons and switches with a tap', async () => {
  renderInMenu();

  await userEvent.click(screen.getByRole('button', { name: 'Dark' }));

  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark'));
  expect(screen.getByRole('button', { name: 'Dark' })).toHaveAttribute('aria-pressed', 'true');
});

it('has no heading of its own, only the three buttons', () => {
  renderInMenu();
  expect(screen.queryByText('Appearance')).not.toBeInTheDocument();
  expect(screen.getAllByRole('button').map((button) => button.textContent)).toEqual(['Auto', 'Light', 'Dark']);
});

it('is a stop for the menu arrow keys, and left and right change the mode', async () => {
  renderInMenu();

  await userEvent.keyboard('{ArrowDown}');
  const row = screen.getByRole('menuitem', { name: /^Appearance: Auto/ });
  expect(row).toHaveFocus();

  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light'));
  await userEvent.keyboard('{ArrowRight}');
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-color-scheme', 'dark'));
  await userEvent.keyboard('{ArrowLeft}');
  await waitFor(() => expect(document.documentElement).toHaveAttribute('data-color-scheme', 'light'));
});
