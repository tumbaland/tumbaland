import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { APPS } from '../config/apps';
import { getModuleMenu } from './ModuleMenu';

function renderMenu(appName: string, route: string) {
  const app = APPS.find(({ name }) => name === appName);
  if (!app) throw new Error(`Missing app: ${appName}`);

  render(<MemoryRouter initialEntries={[route]}>{getModuleMenu(app, route)}</MemoryRouter>);
}

it('restores the Album menu inside the shell', async () => {
  renderMenu('Album', '/album/albums');

  expect(screen.getByRole('navigation', { name: 'Album menu' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Album menu' }));
  expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/album/dashboard');
  expect(screen.getByRole('menuitem', { name: 'Albums' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('menuitem', { name: 'Collages' })).toHaveAttribute('href', '/album/collages');
});

it('restores the Money menu inside the shell', async () => {
  renderMenu('Money', '/finance/cash-flow');

  expect(screen.getByRole('navigation', { name: 'Money menu' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Money menu' }));
  for (const label of ['Dashboard', 'Net Worth', 'Cash Flow', 'Investments', 'Planner']) {
    expect(screen.getByRole('menuitem', { name: label })).toBeInTheDocument();
  }
  expect(screen.getByRole('menuitem', { name: 'Cash Flow' })).toHaveAttribute('aria-current', 'page');
});

it('restores the Journal menu inside the shell', async () => {
  renderMenu('Journal', '/relationship/journal');

  expect(screen.getByRole('navigation', { name: 'Journal menu' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Journal menu' }));
  expect(screen.getByRole('menuitem', { name: 'Dashboard' })).toHaveAttribute('href', '/relationship/dashboard');
  expect(screen.getByRole('menuitem', { name: 'Entries' })).toHaveAttribute('aria-current', 'page');
  expect(screen.getByRole('menuitem', { name: 'Map' })).toHaveAttribute('href', '/relationship/map');
});
