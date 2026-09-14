import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

// The plan card fetches entitlements on mount; the home page's own tests care
// about modules and greetings, not about payment-service being reachable.
vi.mock('../components/home/PlanUsageCard', () => ({ PlanUsageCard: () => null }));

vi.mock('../hooks/useTodo', () => ({
  useTodo: () => ({ todo: 'Water the plants', isLoading: false, error: null, fetchTodo: vi.fn() })
}));

import HomePage from './HomePage';
import { HOME_MODULES, journalTodayKey } from '../components/home/modules';
import { User } from '../types';

const USER: User = { id: '1', email: 'toomas@example.com', name: 'Toomas Tahves' };

function renderHome(user: User | null = USER) {
  return render(
    <MemoryRouter>
      <HomePage user={user} />
    </MemoryRouter>
  );
}

beforeEach(() => {
  navigate.mockReset();
  window.localStorage.clear();
});

it('greets the user by first name', () => {
  renderHome();
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent(/Toomas/);
  expect(screen.getByRole('heading', { level: 1 })).not.toHaveTextContent(/Tahves/);
});

it('falls back to a generic welcome when there is no name', () => {
  renderHome({ ...USER, name: '' });
  expect(screen.getByRole('heading', { level: 1 })).toHaveTextContent('Welcome to Tumbaland');
});

it('opens today in the journal from the first quick action', async () => {
  const user = userEvent.setup();
  renderHome();

  const actions = screen.getByRole('navigation', { name: 'Quick actions' });
  await user.click(within(actions).getByRole('button', { name: 'Log today' }));

  // The journal opens its day editor for a ?date= link.
  expect(navigate).toHaveBeenCalledWith(`/relationship/journal?date=${journalTodayKey()}`);
});

it('deep-links straight to a sub-page from a quick action', async () => {
  const user = userEvent.setup();
  renderHome();

  await user.click(screen.getByRole('button', { name: 'Net worth' }));

  expect(navigate).toHaveBeenCalledWith('/finance/net-worth');
});

it('lists every module, in the order the tab bar shows them', () => {
  renderHome();

  const list = screen.getByRole('region', { name: 'Modules' });
  const rows = within(list).getAllByRole('button');
  expect(rows.map((row) => row.getAttribute('aria-label'))).toEqual(
    HOME_MODULES.map((module) => `Open ${module.name}`)
  );
});

it('navigates into a module from its row', async () => {
  const user = userEvent.setup();
  renderHome();

  await user.click(screen.getByRole('button', { name: 'Open Money' }));

  expect(navigate).toHaveBeenCalledWith('/finance/dashboard');
});

it('offers no resume shortcut on a first visit', () => {
  renderHome();
  expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
});

it('goes back to the exact page the user was last on, not just the module', async () => {
  window.localStorage.setItem('tumbaland:last-visited', '/finance/net-worth');
  const user = userEvent.setup();
  renderHome();

  await user.click(screen.getByRole('button', { name: 'Back to Money' }));

  expect(navigate).toHaveBeenCalledWith('/finance/net-worth');
});

it('ignores a stored route that no longer maps to a module', () => {
  window.localStorage.setItem('tumbaland:last-visited', '/some-removed-app');
  renderHome();
  expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
});

it('keeps the daily idea on the page', () => {
  renderHome();
  expect(screen.getByText('Water the plants')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Show another idea' })).toBeInTheDocument();
});
