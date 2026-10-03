import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { beforeEach, expect, it, vi } from 'vitest';

const navigate = vi.fn();

vi.mock('react-router', async () => {
  const actual = await vi.importActual<typeof import('react-router')>('react-router');
  return { ...actual, useNavigate: () => navigate };
});

// The plan card fetches entitlements on mount; the home page's own tests care
// about modules and greetings, not about payment-service being reachable.

vi.mock('../hooks/useTodo', () => ({
  useTodo: () => ({ todo: 'Water the plants', isLoading: false, error: null, fetchTodo: vi.fn() })
}));

import HomePage from './HomePage';
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

it('has no Log, Albums or Chat buttons: the menu beside the page already has them', () => {
  renderHome();
  expect(screen.queryByRole('navigation', { name: 'Quick actions' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Log today' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Albums' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: 'Chat' })).not.toBeInTheDocument();
});

it('keeps money off the shared home page', () => {
  renderHome();
  expect(screen.queryByRole('button', { name: /money|net worth/i })).not.toBeInTheDocument();
});

it('repeats neither the navigation nor a way back: the menu covers both', () => {
  window.localStorage.setItem('tumbaland:last-visited', '/album/albums/a1');
  renderHome();

  expect(screen.queryByRole('region', { name: 'Modules' })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^Back to|^Open (Journal|Album|Groups)$/ })).not.toBeInTheDocument();
});

it('keeps the daily idea on the page', () => {
  renderHome();
  expect(screen.getByText('Water the plants')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Show another idea' })).toBeInTheDocument();
});
