import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { beforeEach, expect, it, vi } from 'vitest';

const fetchTodo = vi.fn();
const state = {
  todo: 'Water the plants' as string | null,
  isLoading: false,
  error: null as string | null
};

vi.mock('../../hooks/useTodo', () => ({
  useTodo: () => ({ ...state, fetchTodo })
}));

import { DailyTodo } from './DailyTodo';

const LONG_TODO =
  "Explore Helsinki's historic Market Square and Old Market Hall (Finland), then walk the waterfront";

beforeEach(() => {
  fetchTodo.mockReset();
  state.todo = 'Water the plants';
  state.isLoading = false;
  state.error = null;
});

it('shows the idea and a way to reroll it', async () => {
  const user = userEvent.setup();
  render(<DailyTodo />);

  expect(screen.getByText('Water the plants')).toBeInTheDocument();
  await user.click(screen.getByRole('button', { name: 'Show another idea' }));
  expect(fetchTodo).toHaveBeenCalledTimes(1);
});

it('lets a long idea wrap instead of clipping it to one line', () => {
  state.todo = LONG_TODO;
  render(<DailyTodo />);

  const text = screen.getByText(LONG_TODO);
  // `nowrap` was what truncated long entries; the clamp allows three lines.
  expect(text).not.toHaveStyle({ whiteSpace: 'nowrap' });
  expect(text).toHaveAttribute('title', LONG_TODO);
});

it('does not advertise a tooltip when there is nothing to show', () => {
  state.todo = null;
  state.error = 'boom';
  render(<DailyTodo />);

  expect(screen.getByText('Could not load an idea')).not.toHaveAttribute('title');
});

it('disables the reroll while a fetch is in flight', () => {
  state.isLoading = true;
  render(<DailyTodo />);
  expect(screen.getByRole('button', { name: 'Show another idea' })).toBeDisabled();
});
