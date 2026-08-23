import { render, screen } from '@testing-library/react';
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
import { HOME_MODULES } from '../components/home/modules';
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

it('offers a card for every module', () => {
  renderHome();
  HOME_MODULES.forEach((module) => {
    expect(screen.getByRole('heading', { name: module.name })).toBeInTheDocument();
  });
});

it('navigates into a module when its card is opened', async () => {
  const user = userEvent.setup();
  renderHome();

  await user.click(screen.getByRole('button', { name: 'Open Finance' }));

  expect(navigate).toHaveBeenCalledWith('/finance/dashboard');
});

it('deep-links straight to a sub-page from a quick action', async () => {
  const user = userEvent.setup();
  renderHome();

  await user.click(screen.getByRole('button', { name: 'Net worth' }));

  expect(navigate).toHaveBeenCalledWith('/finance/net-worth');
});

it('offers no resume shortcut on a first visit', () => {
  renderHome();
  expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
});

it('offers a way back to the module the user was last in', async () => {
  window.localStorage.setItem('tumbaland:last-visited', '/relationship/journal');
  const user = userEvent.setup();
  renderHome();

  const resume = screen.getByRole('button', { name: 'Back to Relationship' });
  await user.click(resume);

  expect(navigate).toHaveBeenCalledWith('/relationship/journal');
});

it('ignores a stored route that no longer maps to a module', () => {
  window.localStorage.setItem('tumbaland:last-visited', '/some-removed-app');
  renderHome();
  expect(screen.queryByRole('button', { name: /^Back to/ })).not.toBeInTheDocument();
});

it('keeps the daily idea as a strip rather than the whole page', () => {
  renderHome();
  expect(screen.getByText('Water the plants')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Show another idea' })).toBeInTheDocument();
});
