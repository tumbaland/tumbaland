import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../../services/trackedTickerService', () => ({
  searchTickers: vi.fn()
}));

import { searchTickers } from '../../services/trackedTickerService';
import TickerSearch from './TickerSearch';

const mockedSearch = searchTickers as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => vi.clearAllMocks());

it('does not search for a query shorter than 2 characters', async () => {
  render(<TickerSearch onSelect={vi.fn()} />);
  await userEvent.type(screen.getByPlaceholderText(/search symbol or name/i), 'a');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  expect(mockedSearch).not.toHaveBeenCalled();
});

it('searches on button click and renders results', async () => {
  mockedSearch.mockResolvedValue([{ symbol: 'AAPL', name: 'Apple Inc', type: 'Equity', region: 'US', currency: 'USD', matchScore: '1.0' }]);
  render(<TickerSearch onSelect={vi.fn()} />);

  await userEvent.type(screen.getByPlaceholderText(/search symbol or name/i), 'apple');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  expect(await screen.findByText('AAPL — Apple Inc')).toBeInTheDocument();
  expect(mockedSearch).toHaveBeenCalledWith('apple');
});

it('searches when Enter is pressed', async () => {
  mockedSearch.mockResolvedValue([]);
  render(<TickerSearch onSelect={vi.fn()} />);

  await userEvent.type(screen.getByPlaceholderText(/search symbol or name/i), 'apple{Enter}');

  expect(mockedSearch).toHaveBeenCalledWith('apple');
});

it('shows an error message when the search fails', async () => {
  mockedSearch.mockRejectedValue(new Error('rate limited'));
  render(<TickerSearch onSelect={vi.fn()} />);

  await userEvent.type(screen.getByPlaceholderText(/search symbol or name/i), 'apple');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));

  expect(await screen.findByText(/search failed/i)).toBeInTheDocument();
});

it('calls onSelect and clears the query/results when a result is chosen', async () => {
  const result = { symbol: 'AAPL', name: 'Apple Inc', type: 'Equity', region: 'US', currency: 'USD', matchScore: '1.0' };
  mockedSearch.mockResolvedValue([result]);
  const onSelect = vi.fn();
  render(<TickerSearch onSelect={onSelect} />);

  const input = screen.getByPlaceholderText(/search symbol or name/i) as HTMLInputElement;
  await userEvent.type(input, 'apple');
  await userEvent.click(screen.getByRole('button', { name: 'Search' }));
  await userEvent.click(await screen.findByText('AAPL — Apple Inc'));

  expect(onSelect).toHaveBeenCalledWith(result);
  expect(input.value).toBe('');
  expect(screen.queryByText('AAPL — Apple Inc')).not.toBeInTheDocument();
});
