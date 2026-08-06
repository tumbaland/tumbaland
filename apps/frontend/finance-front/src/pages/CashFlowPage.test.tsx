import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useTenantFilter: () => undefined };
});

const mockedUseTransactions = vi.fn();
const mockedUseSummary = vi.fn();
const mockedCreate = vi.fn();
const mockedUpdate = vi.fn();
const mockedDelete = vi.fn();

vi.mock('../hooks/useCashflow', () => ({
  useTransactions: (...args: unknown[]) => mockedUseTransactions(...args),
  useTransactionCategories: () => ({ data: ['Rent', 'Salary'] }),
  useCashflowSummary: (...args: unknown[]) => mockedUseSummary(...args),
  useBudgets: () => ({ data: [] }),
  useCreateTransaction: () => ({ mutateAsync: mockedCreate, isPending: false }),
  useUpdateTransaction: () => ({ mutateAsync: mockedUpdate, isPending: false }),
  useDeleteTransaction: () => ({ mutateAsync: mockedDelete }),
  useCreateBudget: () => ({ mutateAsync: vi.fn(), isPending: false }),
  useUpdateBudget: () => ({ mutateAsync: vi.fn() }),
  useDeleteBudget: () => ({ mutateAsync: vi.fn() })
}));

import CashFlowPage from './CashFlowPage';
import { Transaction } from '../services/cashflowService';

const transactions: Transaction[] = [
  { _id: 'x1', date: '2026-07-05', amount: 3000, type: 'income', category: 'Salary' },
  { _id: 'x2', date: '2026-07-06', amount: 900, type: 'expense', category: 'Rent', note: 'July' }
];

const summary = {
  months: [{ month: '2026-07', income: 3000, expense: 900, savings: 2100, savingsRate: 70 }],
  categories: [{ category: 'Rent', spent: 900, budget: null, variance: null }],
  totals: { month: 'all', income: 3000, expense: 900, savings: 2100, savingsRate: 70 },
  growth: null
};

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

beforeEach(() => {
  vi.clearAllMocks();
  setMobile(false);
  mockedUseTransactions.mockReturnValue({ data: transactions, isLoading: false, error: null });
  mockedUseSummary.mockReturnValue({ data: summary });
});

afterEach(() => setMobile(false));

it('shows a spinner while loading', () => {
  mockedUseTransactions.mockReturnValue({ data: [], isLoading: true, error: null });

  render(<CashFlowPage />);

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error when the query fails', () => {
  mockedUseTransactions.mockReturnValue({ data: [], isLoading: false, error: new Error('boom') });

  render(<CashFlowPage />);

  expect(screen.getByText('Failed to load transactions')).toBeInTheDocument();
});

it('lists transactions with income positive and expense negative', () => {
  render(<CashFlowPage />);

  expect(screen.getByText('+3000 €')).toBeInTheDocument();
  expect(screen.getByText('−900 €')).toBeInTheDocument();
  expect(screen.getByText('July')).toBeInTheDocument();
});

it('shows the summary cards when there is a month of data', () => {
  render(<CashFlowPage />);

  expect(screen.getByText('Savings rate')).toBeInTheDocument();
});

it('explains the point of the page when there is nothing recorded', () => {
  mockedUseTransactions.mockReturnValue({ data: [], isLoading: false, error: null });
  mockedUseSummary.mockReturnValue({ data: { ...summary, months: [] } });

  render(<CashFlowPage />);

  expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /add your first transaction/i })).toBeInTheDocument();
});

it('adds a transaction through the dialog', async () => {
  mockedCreate.mockResolvedValue({});

  render(<CashFlowPage />);

  await userEvent.click(screen.getByRole('button', { name: /add transaction/i }));
  await userEvent.type(screen.getByLabelText(/amount/i), '250');
  await userEvent.type(screen.getByLabelText(/category/i), 'Travel');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() =>
    expect(mockedCreate).toHaveBeenCalledWith(
      expect.objectContaining({ amount: 250, category: 'Travel', type: 'expense' })
    )
  );
});

it('pre-fills the dialog when editing', async () => {
  render(<CashFlowPage />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[1]);

  expect(screen.getByLabelText(/amount/i)).toHaveValue('900');
  expect(screen.getByText('Edit transaction')).toBeInTheDocument();
});

it('updates an existing transaction', async () => {
  mockedUpdate.mockResolvedValue({});

  render(<CashFlowPage />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[1]);
  await userEvent.click(screen.getByRole('button', { name: 'Update' }));

  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith(expect.objectContaining({ id: 'x2' })));
});

it('deletes a transaction after confirming', async () => {
  mockedDelete.mockResolvedValue({});

  render(<CashFlowPage />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('x1'));
});

it('reports a failed delete', async () => {
  mockedDelete.mockRejectedValue(new Error('nope'));

  render(<CashFlowPage />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() =>
    expect(screen.getByText('Failed to delete the transaction')).toBeInTheDocument()
  );
});

it('opens the budget manager', async () => {
  render(<CashFlowPage />);

  await userEvent.click(screen.getByRole('button', { name: /budgets/i }));

  expect(screen.getByText('Monthly budgets')).toBeInTheDocument();
});

it('renders transaction cards in the mobile layout', () => {
  setMobile(true);

  render(<CashFlowPage />);

  expect(screen.getByText('Salary')).toBeInTheDocument();
  expect(screen.getByText('+3000 €')).toBeInTheDocument();
});
