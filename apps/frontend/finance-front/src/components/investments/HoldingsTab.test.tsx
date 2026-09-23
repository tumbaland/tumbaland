import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ComponentProps } from 'react';
import type TickerSearch from './TickerSearch';

const mockedCreateMutateAsync = vi.fn();
const mockedUpdateMutateAsync = vi.fn();
const mockedDeleteMutateAsync = vi.fn();

vi.mock('../../hooks/useHoldings', () => ({
  useCreateHolding: () => ({ mutateAsync: mockedCreateMutateAsync, isPending: false }),
  useUpdateHolding: () => ({ mutateAsync: mockedUpdateMutateAsync, isPending: false }),
  useDeleteHolding: () => ({ mutateAsync: mockedDeleteMutateAsync, isPending: false })
}));

vi.mock('./TickerSearch', () => ({
  default: ({ onSelect }: ComponentProps<typeof TickerSearch>) => (
    <button onClick={() => onSelect({ symbol: 'MSFT', name: 'Microsoft', type: 'Equity', region: 'United States', currency: 'USD', matchScore: '1.0000' })}>pick MSFT</button>
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

function setMobile(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isMobile,
    media: query,
    onchange: null,
    addListener: () => {},
    removeListener: () => {},
    addEventListener: () => {},
    removeEventListener: () => {},
    dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

afterEach(() => setMobile(false));

// The backend supplies costBasis/currentValue already converted into
// baseCurrency; per-share amounts stay in the instrument's own currency.
const holdings: Holding[] = [
  {
    _id: 'h1',
    ticker: 'AAPL',
    displayName: 'Apple',
    quantity: 10,
    avgBuyPrice: 100,
    currency: 'EUR',
    baseCurrency: 'EUR',
    fxRate: 1,
    latestPrice: 150,
    latestPriceDate: '2024-05-01',
    costBasis: 1000,
    currentValue: 1500,
    valueIncrease: 500,
    percentIncrease: 50
  },
  {
    _id: 'h2',
    ticker: 'BND',
    quantity: 5,
    avgBuyPrice: 80,
    currency: 'EUR',
    baseCurrency: 'EUR',
    fxRate: 1,
    costBasis: 400
  }
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
    currency: 'USD',
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

it('renders holding cards in the mobile layout, supporting edit/delete/history from there', async () => {
  setMobile(true);
  mockedUpdateMutateAsync.mockResolvedValue({});
  render(<HoldingsTab holdings={holdings} notify={vi.fn()} />);

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('no data')).toBeInTheDocument();

  const historyButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="ShowChartIcon"]'));
  await userEvent.click(historyButtons[0]);
  expect(screen.getByText('history for AAPL')).toBeInTheDocument();
  await userEvent.click(screen.getByText('close history'));

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);
  expect(screen.getByLabelText(/^Ticker/)).toHaveValue('AAPL');
  await userEvent.click(screen.getByRole('button', { name: 'Update' }));
  expect(mockedUpdateMutateAsync).toHaveBeenCalled();
});

it('cancels the delete confirmation without deleting', async () => {
  const notify = vi.fn();
  render(<HoldingsTab holdings={holdings} notify={notify} />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

  expect(mockedDeleteMutateAsync).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText('Delete holding')).not.toBeInTheDocument());
});

it('allows typing a display name directly when creating a holding', async () => {
  mockedCreateMutateAsync.mockResolvedValue({});
  const notify = vi.fn();
  render(<HoldingsTab holdings={[]} notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
  await userEvent.type(screen.getByLabelText(/^Ticker/), 'msft');
  await userEvent.type(screen.getByLabelText('Display name'), 'Microsoft');
  await userEvent.type(screen.getByLabelText(/^Quantity/), '2');
  await userEvent.type(screen.getByLabelText(/^Average buy price/), '150');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(mockedCreateMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ ticker: 'MSFT', displayName: 'Microsoft' })
  );
});

it('cancels the add-holding dialog', async () => {
  render(<HoldingsTab holdings={[]} notify={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByLabelText('Ticker')).not.toBeInTheDocument();
});

it('shows per-share prices in the instrument currency and totals in the base currency', () => {
  render(
    <HoldingsTab
      holdings={[
        {
          _id: 'h3',
          ticker: 'VOO',
          displayName: 'Vanguard S&P 500',
          quantity: 10,
          avgBuyPrice: 400,
          currency: 'USD',
          baseCurrency: 'EUR',
          fxRate: 0.9,
          latestPrice: 500,
          costBasis: 3600,
          currentValue: 4500,
          valueIncrease: 900,
          percentIncrease: 25
        }
      ]}
      notify={vi.fn()}
    />
  );

  // Native currency for the per-share figures
  expect(screen.getByText('500,00 $')).toBeInTheDocument();
  // Base currency for the totals
  expect(screen.getAllByText('4500 €').length).toBeGreaterThan(0);
});

it('warns about and excludes holdings with no exchange rate', () => {
  render(
    <HoldingsTab
      holdings={[
        { _id: 'h1', ticker: 'AAPL', quantity: 1, avgBuyPrice: 10, currency: 'EUR', baseCurrency: 'EUR', costBasis: 10 },
        {
          _id: 'h4',
          ticker: 'TSE',
          quantity: 1,
          avgBuyPrice: 100,
          currency: 'JPY',
          baseCurrency: 'EUR',
          missingFxRate: true,
          latestPrice: 120,
          percentIncrease: 20
        }
      ]}
      notify={vi.fn()}
    />
  );

  expect(screen.getByText(/no exchange rate yet for jpy/i)).toBeInTheDocument();
  // The unconvertible position is left out of the cost total
  expect(screen.getAllByText('10 €').length).toBeGreaterThan(0);
});

it('submits buy date and notes when adding a holding', async () => {
  mockedCreateMutateAsync.mockResolvedValue({});
  render(<HoldingsTab holdings={[]} notify={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: /add holding/i }));
  await userEvent.type(screen.getByLabelText(/^Ticker/), 'AAPL');
  await userEvent.type(screen.getByLabelText(/^Quantity/), '3');
  await userEvent.type(screen.getByLabelText(/average buy price/i), '99');
  await userEvent.type(screen.getByLabelText(/buy date/i), '2024-03-01');
  await userEvent.type(screen.getByLabelText(/notes/i), 'ISA account');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(mockedCreateMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ ticker: 'AAPL', buyDate: '2024-03-01', notes: 'ISA account' })
  );
});

it('pre-fills buy date and notes when editing', async () => {
  render(
    <HoldingsTab
      holdings={[
        { _id: 'h1', ticker: 'AAPL', quantity: 1, avgBuyPrice: 10, buyDate: '2024-03-01T00:00:00.000Z', notes: 'ISA' }
      ]}
      notify={vi.fn()}
    />
  );

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);

  expect(screen.getByLabelText(/buy date/i)).toHaveValue('2024-03-01');
  expect(screen.getByLabelText(/notes/i)).toHaveValue('ISA');
});
