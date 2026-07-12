import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedCreateMutateAsync = vi.fn();
const mockedUpdateMutateAsync = vi.fn();
const mockedDeleteMutateAsync = vi.fn();

vi.mock('../../hooks/useHoldings', () => ({
  useCreateHolding: () => ({ mutateAsync: mockedCreateMutateAsync, isPending: false }),
  useUpdateHolding: () => ({ mutateAsync: mockedUpdateMutateAsync, isPending: false }),
  useDeleteHolding: () => ({ mutateAsync: mockedDeleteMutateAsync, isPending: false })
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

import HoldingsTab from './HoldingsTab';
import { Holding } from '../../services/holdingService';

const holdings: Holding[] = [
  {
    _id: 'h1',
    ticker: 'AAPL',
    displayName: 'Apple',
    quantity: 10,
    avgBuyPrice: 100,
    latestPrice: 150,
    latestPriceDate: '2024-05-01',
    currentValue: 1500,
    valueIncrease: 500,
    percentIncrease: 50
  },
  { _id: 'h2', ticker: 'BND', quantity: 5, avgBuyPrice: 80 }
];

beforeEach(() => vi.clearAllMocks());

it('shows an empty state when there are no holdings', () => {
  render(<HoldingsTab holdings={[]} notify={vi.fn()} />);
  expect(screen.getByText(/no holdings yet/i)).toBeInTheDocument();
});

it('renders holding rows with totals, defaulting missing fields to em dashes', () => {
  render(<HoldingsTab holdings={holdings} notify={vi.fn()} />);

  expect(screen.getByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('BND')).toBeInTheDocument();
  expect(screen.getByText('no data')).toBeInTheDocument(); // BND has no latestPrice
  // Totals row: cost = 10*100 + 5*80 = 1400
  expect(screen.getByText('1400 €')).toBeInTheDocument();
});

it('validates required fields before submitting a new holding', async () => {
  const notify = vi.fn();
  render(<HoldingsTab holdings={[]} notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(notify).toHaveBeenCalledWith('Ticker, quantity and average buy price are required', 'error');
  expect(mockedCreateMutateAsync).not.toHaveBeenCalled();
});

it('creates a holding via the form, including a group id when tenant-scoped', async () => {
  mockedCreateMutateAsync.mockResolvedValue({});
  const notify = vi.fn();
  render(<HoldingsTab holdings={[]} tenantGroupId="g1" notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
  await userEvent.click(screen.getByText('pick MSFT'));
  await userEvent.type(screen.getByLabelText(/^Quantity/), '3');
  await userEvent.type(screen.getByLabelText(/^Average buy price/), '200');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(mockedCreateMutateAsync).toHaveBeenCalledWith({
    ticker: 'MSFT',
    displayName: 'Microsoft',
    quantity: 3,
    avgBuyPrice: 200,
    groupId: 'g1'
  });
  expect(notify).toHaveBeenCalledWith('Holding added — its ticker is now tracked for daily prices', 'success');
});

it('shows an error notification when creating a holding fails', async () => {
  mockedCreateMutateAsync.mockRejectedValue(new Error('fail'));
  const notify = vi.fn();
  render(<HoldingsTab holdings={[]} notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
  await userEvent.type(screen.getByLabelText(/^Ticker/), 'aapl');
  await userEvent.type(screen.getByLabelText(/^Quantity/), '1');
  await userEvent.type(screen.getByLabelText(/^Average buy price/), '1');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(notify).toHaveBeenCalledWith('Failed to save holding', 'error');
});

it('edits an existing holding, pre-filling the form and omitting the ticker search/display name fields', async () => {
  mockedUpdateMutateAsync.mockResolvedValue({});
  const notify = vi.fn();
  render(<HoldingsTab holdings={holdings} notify={notify} />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);

  expect(screen.queryByText('pick MSFT')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Display name')).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Ticker/)).toHaveValue('AAPL');

  await userEvent.click(screen.getByRole('button', { name: 'Update' }));

  expect(mockedUpdateMutateAsync).toHaveBeenCalledWith({ id: 'h1', data: { ticker: 'AAPL', quantity: 10, avgBuyPrice: 100 } });
  expect(notify).toHaveBeenCalledWith('Holding updated', 'success');
});

it('deletes a holding after confirming, and shows an error notification on failure', async () => {
  mockedDeleteMutateAsync.mockRejectedValueOnce(new Error('fail'));
  const notify = vi.fn();
  render(<HoldingsTab holdings={holdings} notify={notify} />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Delete' }));

  expect(mockedDeleteMutateAsync).toHaveBeenCalledWith('h1');
  expect(notify).toHaveBeenCalledWith('Failed to delete holding', 'error');
});

it('opens and closes the price history modal for a holding', async () => {
  render(<HoldingsTab holdings={holdings} notify={vi.fn()} />);

  const historyButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="ShowChartIcon"]'));
  await userEvent.click(historyButtons[0]);

  expect(screen.getByText('history for AAPL')).toBeInTheDocument();

  await userEvent.click(screen.getByText('close history'));
  expect(screen.queryByText('history for AAPL')).not.toBeInTheDocument();
});

it('cancels the add-holding dialog', async () => {
  render(<HoldingsTab holdings={[]} notify={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByLabelText('Ticker')).not.toBeInTheDocument();
});
