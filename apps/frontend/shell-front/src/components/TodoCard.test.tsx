import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/publicApi', () => ({
  publicApi: { get: vi.fn() }
}));

import { publicApi } from '../services/publicApi';
import TodoCard from './TodoCard';

const mockedGet = publicApi.get as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('shows the fetched todo and rolls a new one on click', async () => {
  mockedGet.mockResolvedValueOnce({ todo: 'First todo' }).mockResolvedValueOnce({ todo: 'Second todo' });
  render(<TodoCard />);

  expect(await screen.findByText('First todo')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Roll for new todo' }));

  await waitFor(() => expect(screen.getByText('Second todo')).toBeInTheDocument());
});

it('shows a failure message when the fetch fails', async () => {
  mockedGet.mockRejectedValue(new Error('boom'));
  render(<TodoCard />);

  expect(await screen.findByText('Failed to load todo')).toBeInTheDocument();
});
