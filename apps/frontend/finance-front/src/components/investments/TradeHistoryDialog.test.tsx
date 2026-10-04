import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

const mockedCreateMutateAsync = vi.fn();
const mockedDeleteMutateAsync = vi.fn();
const mockedUseTrades = vi.fn();
const mockedUsePosition = vi.fn();

vi.mock('../../hooks/useTrades', () => ({
  useTrades: (...args: unknown[]) => mockedUseTrades(...args),
  usePosition: (...args: unknown[]) => mockedUsePosition(...args),
  useCreateTrade: () => ({ mutateAsync: mockedCreateMutateAsync, isPending: false }),
  useDeleteTrade: () => ({ mutateAsync: mockedDeleteMutateAsync })
}));

import TradeHistoryDialog from './TradeHistoryDialog';
import { Trade } from '../../services/tradeService';

const trades: Trade[] = [
  { _id: 't1', ticker: 'AAPL', type: 'buy', date: '2024-01-01', quantity: 10, price: 100, amount: 0, fees: 5 },
  { _id: 't2', ticker: 'AAPL', type: 'dividend', date: '2024-03-01', quantity: 0, price: 0, amount: 45, fees: 0 }
];

const position = {
  ticker: 'AAPL',
  quantity: 10,
  avgBuyPrice: 100.5,
  costBasis: 1005,
  realizedGain: 220,
  dividends: 45,
  fees: 5,
  netInvested: 960,
  tradeCount: 2
};

const renderDialog = (props: Partial<React.ComponentProps<typeof TradeHistoryDialog>> = {}) => {
  const notify = vi.fn();
  render(<TradeHistoryDialog open onClose={vi.fn()} ticker="AAPL" notify={notify} {...props} />);
  return { notify };
};

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseTrades.mockReturnValue({ data: trades, isLoading: false });
  mockedUsePosition.mockReturnValue({ data: position });
});

it('shows a spinner while the log is loading', () => {
  mockedUseTrades.mockReturnValue({ data: [], isLoading: true });

  renderDialog();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('summarises the replayed position', () => {
  renderDialog();

  expect(screen.getByText('Shares held')).toBeInTheDocument();
  expect(screen.getByText('Realized P/L')).toBeInTheDocument();
  expect(screen.getByText('+220 €')).toBeInTheDocument();
  // The dividend total appears both in the summary and in its own row
  expect(screen.getAllByText('45 €').length).toBeGreaterThan(0);
});

it('lists each trade with its type', () => {
  renderDialog();

  expect(screen.getByText('Buy')).toBeInTheDocument();
  expect(screen.getByText('Dividend')).toBeInTheDocument();
  expect(screen.getByText('2024-01-01')).toBeInTheDocument();
});

it('dashes the share columns for a cash-only trade', () => {
  mockedUseTrades.mockReturnValue({ data: [trades[1]], isLoading: false });

  renderDialog();

  // Quantity and price both read as em dashes for a dividend
  expect(screen.getAllByText('—').length).toBeGreaterThanOrEqual(2);
});

it('explains what recording trades does when there are none', () => {
  mockedUseTrades.mockReturnValue({ data: [], isLoading: false });
  mockedUsePosition.mockReturnValue({ data: { ...position, tradeCount: 0 } });

  renderDialog();

  expect(screen.getByText(/No trades recorded for AAPL/)).toBeInTheDocument();
});

it('records a buy from the inline form', async () => {
  mockedCreateMutateAsync.mockResolvedValue({});
  const { notify } = renderDialog({ tenantGroupId: 'g1' });

  await userEvent.click(screen.getByRole('button', { name: /add trade/i }));
  await userEvent.type(screen.getByLabelText(/^Quantity/), '5');
  await userEvent.type(screen.getByLabelText(/price per share/i), '120');
  await userEvent.click(screen.getByRole('button', { name: /record trade/i }));

  await waitFor(() =>
    expect(mockedCreateMutateAsync).toHaveBeenCalledWith(
      expect.objectContaining({ ticker: 'AAPL', type: 'buy', quantity: 5, price: 120, groupId: 'g1' })
    )
  );
  expect(notify).toHaveBeenCalledWith(expect.stringContaining('Trade recorded'), 'success');
});

it('rejects a buy with no quantity', async () => {
  const { notify } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: /add trade/i }));
  await userEvent.type(screen.getByLabelText(/price per share/i), '120');
  await userEvent.click(screen.getByRole('button', { name: /record trade/i }));

  expect(notify).toHaveBeenCalledWith('A buy or sell needs a quantity and a price', 'error');
  expect(mockedCreateMutateAsync).not.toHaveBeenCalled();
});

it('swaps the form to a single amount field for a dividend', async () => {
  renderDialog();

  await userEvent.click(screen.getByRole('button', { name: /add trade/i }));
  await userEvent.click(screen.getByLabelText('Type'));
  await userEvent.click(screen.getByRole('option', { name: 'Dividend' }));

  expect(screen.queryByLabelText(/^Quantity/)).not.toBeInTheDocument();
  expect(screen.getByLabelText(/^Amount/)).toBeInTheDocument();
});

it('rejects a dividend with no amount', async () => {
  const { notify } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: /add trade/i }));
  await userEvent.click(screen.getByLabelText('Type'));
  await userEvent.click(screen.getByRole('option', { name: 'Dividend' }));
  await userEvent.click(screen.getByRole('button', { name: /record trade/i }));

  expect(notify).toHaveBeenCalledWith('A dividend needs an amount', 'error');
});

it('notifies when recording fails', async () => {
  mockedCreateMutateAsync.mockRejectedValue(new Error('nope'));
  const { notify } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: /add trade/i }));
  await userEvent.type(screen.getByLabelText(/^Quantity/), '5');
  await userEvent.type(screen.getByLabelText(/price per share/i), '120');
  await userEvent.click(screen.getByRole('button', { name: /record trade/i }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to record the trade', 'error'));
});

it('closes the inline form on cancel', async () => {
  renderDialog();

  await userEvent.click(screen.getByRole('button', { name: /add trade/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  expect(screen.queryByRole('button', { name: /record trade/i })).not.toBeInTheDocument();
});

it('deletes a trade after confirming', async () => {
  mockedDeleteMutateAsync.mockResolvedValue({});
  const { notify } = renderDialog();

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(mockedDeleteMutateAsync).toHaveBeenCalledWith('t1'));
  expect(notify).toHaveBeenCalledWith(expect.stringContaining('Trade deleted'), 'success');
});

it('notifies when deleting fails', async () => {
  mockedDeleteMutateAsync.mockRejectedValue(new Error('nope'));
  const { notify } = renderDialog();

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to delete the trade', 'error'));
});
