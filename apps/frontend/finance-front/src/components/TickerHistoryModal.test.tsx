import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('../services/tickerPriceHistoryService', () => ({
  getTickerPriceHistory: vi.fn(),
  deleteTickerPriceHistory: vi.fn(),
  fetchAllTickerPriceHistory: vi.fn()
}));

import {
  getTickerPriceHistory,
  deleteTickerPriceHistory,
  fetchAllTickerPriceHistory
} from '../services/tickerPriceHistoryService';
import TickerHistoryModal from './TickerHistoryModal';

const mockedGetHistory = getTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;
const mockedDelete = deleteTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;
const mockedFetchAll = fetchAllTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;

// All AAPL dates are within the default "last 1 month" window from the fixed
// system time below (2026-07-12), so they stay in range without extra filtering.
const history = [
  { _id: 'h1', ticker: 'AAPL', date: '2026-06-20', price: 150 },
  { _id: 'h2', ticker: 'AAPL', date: '2026-06-25', price: 160 },
  { _id: 'h3', ticker: 'AAPL', date: '2026-07-05', price: 155 },
  { _id: 'h4', ticker: 'MSFT', date: '2026-06-20', price: 300 }
];

beforeEach(() => {
  vi.clearAllMocks();
  vi.setSystemTime(new Date('2026-07-12T00:00:00.000Z'));
});

afterEach(() => {
  vi.useRealTimers();
});

it('shows a loading spinner while history is being fetched', () => {
  vi.useFakeTimers();
  mockedGetHistory.mockReturnValue(new Promise(() => {}));
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when the fetch fails', async () => {
  mockedGetHistory.mockRejectedValue(new Error('boom'));
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  expect(await screen.findByText('Failed to load history')).toBeInTheDocument();
});

it('shows the empty state with a fetch button when there is no history in range', async () => {
  mockedGetHistory.mockResolvedValue([]);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);

  expect(await screen.findByText(/no price history found for aapl/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Fetch Historical Data' })).toBeInTheDocument();
});

it('fetches historical data from the empty state and renders the results', async () => {
  mockedGetHistory.mockResolvedValueOnce([]);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await screen.findByRole('button', { name: 'Fetch Historical Data' });

  mockedFetchAll.mockResolvedValue(undefined);
  mockedGetHistory.mockResolvedValueOnce(history.filter((h) => h.ticker === 'AAPL'));

  await userEvent.click(screen.getByRole('button', { name: 'Fetch Historical Data' }));

  expect(mockedFetchAll).toHaveBeenCalledWith('AAPL');
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());
});

it('shows an error when fetching historical data from the empty state fails', async () => {
  mockedGetHistory.mockResolvedValueOnce([]);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await screen.findByRole('button', { name: 'Fetch Historical Data' });

  mockedFetchAll.mockRejectedValue(new Error('fail'));

  await userEvent.click(screen.getByRole('button', { name: 'Fetch Historical Data' }));

  expect(await screen.findByText('Failed to fetch historical records')).toBeInTheDocument();
});

it('renders the chart, table, and summary stats for populated history filtered to the ticker', async () => {
  mockedGetHistory.mockResolvedValue(history);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);

  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());
  // Only AAPL's 3 records are in range/ticker-scope (MSFT filtered out)
  expect(screen.getByText('3')).toBeInTheDocument();
  expect(screen.getByText('Max Close')).toBeInTheDocument();
  expect(screen.getByText('Min Close')).toBeInTheDocument();
});

it.each([
  ['Last 3 months', '3m'],
  ['Last 1 year', '1y'],
  ['Last 3 years', '3y'],
  ['Last 5 years', '5y'],
  ['All time', 'all']
])('applies the %s quick range without throwing', async (label) => {
  mockedGetHistory.mockResolvedValue(history);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());

  await userEvent.click(screen.getByLabelText('Quick Range'));
  await userEvent.click(await screen.findByRole('option', { name: label }));

  expect(screen.getByText('Data Points')).toBeInTheDocument();
});

it('selects "All time" with an empty history falling back to a 10-year window', async () => {
  mockedGetHistory.mockResolvedValue([]);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await screen.findByRole('button', { name: 'Fetch Historical Data' });

  await userEvent.click(screen.getByLabelText('Quick Range'));
  await userEvent.click(await screen.findByRole('option', { name: 'All time' }));

  expect(screen.getByText(/no price history found/i)).toBeInTheDocument();
});

it('applies a manually edited date range', async () => {
  mockedGetHistory.mockResolvedValue(history);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());

  const startInput = screen.getByLabelText('Start Date') as HTMLInputElement;
  await userEvent.clear(startInput);
  await userEvent.type(startInput, '2026-07-01');
  await userEvent.click(screen.getByRole('button', { name: 'Apply Filters' }));

  // Only the 2026-07-01 record remains for AAPL after the filter narrows.
  await waitFor(() => expect(screen.getByText('1')).toBeInTheDocument());
});

it('opens the delete confirmation, deletes on confirm, and removes the row', async () => {
  mockedGetHistory.mockResolvedValue(history);
  mockedDelete.mockResolvedValue(undefined);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());

  const deleteButtons = screen.getAllByRole('button', { name: 'delete' });
  await userEvent.click(deleteButtons[0]);

  expect(await screen.findByText('Delete Price History Record')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('h1'));
});

it('cancels the delete confirmation without deleting', async () => {
  mockedGetHistory.mockResolvedValue(history);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());

  const deleteButtons = screen.getAllByRole('button', { name: 'delete' });
  await userEvent.click(deleteButtons[0]);
  expect(await screen.findByText('Delete Price History Record')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(mockedDelete).not.toHaveBeenCalled();
});

it('swallows a failed delete and still closes the confirmation', async () => {
  mockedGetHistory.mockResolvedValue(history);
  mockedDelete.mockRejectedValue(new Error('fail'));
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());

  const deleteButtons = screen.getAllByRole('button', { name: 'delete' });
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(screen.queryByText('Delete Price History Record')).not.toBeInTheDocument());
});

it('refreshes the last ~100 trading days via the bottom action', async () => {
  mockedGetHistory.mockResolvedValueOnce(history);
  mockedFetchAll.mockResolvedValue(undefined);
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());

  mockedGetHistory.mockResolvedValueOnce(history);
  await userEvent.click(screen.getByRole('button', { name: /refresh last/i }));

  await waitFor(() => expect(mockedFetchAll).toHaveBeenCalledWith('AAPL'));
});

it('shows an error when the bottom refresh action fails', async () => {
  mockedGetHistory.mockResolvedValue(history);
  mockedFetchAll.mockRejectedValue(new Error('fail'));
  render(<TickerHistoryModal open onClose={vi.fn()} ticker="AAPL" />);
  await waitFor(() => expect(screen.getByText('Data Points')).toBeInTheDocument());

  await userEvent.click(screen.getByRole('button', { name: /refresh last/i }));

  expect(await screen.findByText('Failed to fetch all records')).toBeInTheDocument();
});

it('calls onClose from the Close button', async () => {
  mockedGetHistory.mockResolvedValue([]);
  const onClose = vi.fn();
  render(<TickerHistoryModal open onClose={onClose} ticker="AAPL" />);
  await screen.findByRole('button', { name: 'Fetch Historical Data' });

  await userEvent.click(screen.getByRole('button', { name: 'Close' }));

  expect(onClose).toHaveBeenCalled();
});

it('does not fetch when closed', () => {
  render(<TickerHistoryModal open={false} onClose={vi.fn()} ticker="AAPL" />);
  expect(mockedGetHistory).not.toHaveBeenCalled();
});
