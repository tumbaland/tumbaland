import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedCreateMutateAsync = vi.fn();
const mockedUpdateMutateAsync = vi.fn();
const mockedDeleteMutateAsync = vi.fn();

vi.mock('../../hooks/useTrackedTicker', () => ({
  useCreateTrackedTicker: () => ({ mutateAsync: mockedCreateMutateAsync, isPending: false }),
  useUpdateTrackedTicker: () => ({ mutateAsync: mockedUpdateMutateAsync, isPending: false }),
  useDeleteTrackedTicker: () => ({ mutateAsync: mockedDeleteMutateAsync, isPending: false })
}));

vi.mock('../../services/tickerPriceHistoryService', () => ({
  fetchAllTickerPriceHistory: vi.fn()
}));

vi.mock('./TickerSearch', () => ({
  default: ({ onSelect }: { onSelect: (r: any) => void }) => (
    <button onClick={() => onSelect({ symbol: 'MSFT', name: 'Microsoft' })}>pick MSFT</button>
  )
}));

vi.mock('../TickerHistoryModal', () => ({
  default: ({ ticker, onClose }: { ticker: string; onClose: () => void }) => (
    <div>
      history for {ticker}
      <button onClick={onClose}>close history</button>
    </div>
  )
}));

import { fetchAllTickerPriceHistory } from '../../services/tickerPriceHistoryService';
import TickersTab from './TickersTab';
import { TrackedTicker } from '../../services/trackedTickerService';

const mockedFetchAll = fetchAllTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;

const tickers: TrackedTicker[] = [
  { _id: 't1', ticker: 'AAPL', displayName: 'Apple', isActive: true, dateAdded: '2024-01-01T00:00:00.000Z' },
  { _id: 't2', ticker: 'BND', displayName: 'Vanguard Bond', isActive: false }
];

beforeEach(() => vi.clearAllMocks());

it('shows an empty state when there are no tracked tickers', () => {
  render(<TickersTab tickers={[]} notify={vi.fn()} />);
  expect(screen.getByText(/no tracked tickers/i)).toBeInTheDocument();
});

it('renders ticker rows with active/paused status and a formatted or dashed date', () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Active')).toBeInTheDocument();
  expect(screen.getByText('Paused')).toBeInTheDocument();
  expect(screen.getByText('2024-01-01')).toBeInTheDocument();
  expect(screen.getByText('—')).toBeInTheDocument();
});

it('validates required fields before submitting', async () => {
  const notify = vi.fn();
  render(<TickersTab tickers={[]} notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /track ticker/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(notify).toHaveBeenCalledWith('Ticker and display name are required', 'error');
  expect(mockedCreateMutateAsync).not.toHaveBeenCalled();
});

it('creates a tracked ticker, including a group id when tenant-scoped', async () => {
  mockedCreateMutateAsync.mockResolvedValue({});
  const notify = vi.fn();
  render(<TickersTab tickers={[]} tenantGroupId="g1" notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /track ticker/i }));
  await userEvent.click(screen.getByText('pick MSFT'));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(mockedCreateMutateAsync).toHaveBeenCalledWith({
    ticker: 'MSFT',
    displayName: 'Microsoft',
    description: '',
    isActive: true,
    groupId: 'g1'
  });
  expect(notify).toHaveBeenCalledWith('Ticker added', 'success');
});

it('shows an error notification when creating fails', async () => {
  mockedCreateMutateAsync.mockRejectedValue(new Error('fail'));
  const notify = vi.fn();
  render(<TickersTab tickers={[]} notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /track ticker/i }));
  await userEvent.click(screen.getByText('pick MSFT'));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(notify).toHaveBeenCalledWith('Failed to save ticker', 'error');
});

it('edits an existing ticker, pre-filling the form and toggling the active switch', async () => {
  mockedUpdateMutateAsync.mockResolvedValue({});
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);

  expect(screen.queryByText('pick MSFT')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Ticker/)).toHaveValue('AAPL');

  const activeSwitch = document.querySelector('input[type="checkbox"]') as HTMLInputElement;
  expect(activeSwitch).toBeChecked();
  await userEvent.click(activeSwitch);

  await userEvent.click(screen.getByRole('button', { name: 'Update' }));

  expect(mockedUpdateMutateAsync).toHaveBeenCalledWith({
    id: 't1',
    data: { ticker: 'AAPL', displayName: 'Apple', description: '', isActive: false }
  });
  expect(notify).toHaveBeenCalledWith('Ticker updated', 'success');
});

it('deletes a ticker after confirming, and shows an error notification on failure', async () => {
  mockedDeleteMutateAsync.mockRejectedValueOnce(new Error('fail'));
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(mockedDeleteMutateAsync).toHaveBeenCalledWith('t1');
  expect(notify).toHaveBeenCalledWith('Failed to delete ticker', 'error');
});

it('fetches price history for a ticker and notifies on success', async () => {
  mockedFetchAll.mockResolvedValue(undefined);
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  const fetchButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="CloudDownloadIcon"]'));
  await userEvent.click(fetchButtons[0]);

  expect(mockedFetchAll).toHaveBeenCalledWith('AAPL');
  expect(notify).toHaveBeenCalledWith('Price history fetched for AAPL', 'success');
});

it('notifies with a rate-limit hint when fetching price history fails', async () => {
  mockedFetchAll.mockRejectedValue(new Error('fail'));
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  const fetchButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="CloudDownloadIcon"]'));
  await userEvent.click(fetchButtons[0]);

  expect(notify).toHaveBeenCalledWith(
    expect.stringContaining('Failed to fetch prices for AAPL'),
    'error'
  );
});

it('opens and closes the price history modal', async () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  const historyButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="ShowChartIcon"]'));
  await userEvent.click(historyButtons[0]);
  expect(screen.getByText('history for AAPL')).toBeInTheDocument();

  await userEvent.click(screen.getByText('close history'));
  expect(screen.queryByText('history for AAPL')).not.toBeInTheDocument();
});

it('cancels the add-ticker dialog', async () => {
  render(<TickersTab tickers={[]} notify={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: /track ticker/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Track ticker' })).not.toBeInTheDocument());
});
