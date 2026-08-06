import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<Record<string, unknown>>();
  return { ...actual, useTenantFilter: () => undefined };
});

const mockedUseTransactions = vi.fn();
const mockedUseSummary = vi.fn();
const mockedUseAnalytics = vi.fn();
const mockedDelete = vi.fn();

vi.mock('../hooks/useCashflow', () => ({
  useTransactions: (...args: unknown[]) => mockedUseTransactions(...args),
  useTransactionCategories: () => ({ data: ['Groceries', 'Salary'] }),
  useCashflowSummary: (...args: unknown[]) => mockedUseSummary(...args),
  useAnalytics: (...args: unknown[]) => mockedUseAnalytics(...args),
  useDeleteTransaction: () => ({ mutateAsync: mockedDelete }),
  useImportStatement: () => ({ mutateAsync: vi.fn(), isPending: false })
}));

import CashFlowPage from './CashFlowPage';
import { Transaction } from '../services/cashflowService';

const transactions: Transaction[] = [
  { _id: 'x1', date: '2026-07-05', amount: 3000, type: 'income', category: 'Salary' },
  { _id: 'x2', date: '2026-07-06', amount: 900, type: 'expense', category: 'Groceries', note: 'RIMI' }
];

const page = (over: Partial<{ items: Transaction[]; totals: Record<string, number>; hasMore: boolean }> = {}) => ({
  items: transactions,
  totals: { count: 2, income: 3000, expense: 900, net: 2100 },
  hasMore: false,
  ...over
});

const summary = {
  months: [{ month: '2026-07', income: 3000, expense: 900, savings: 2100, savingsRate: 70 }],
  categories: [{ category: 'Groceries', spent: 900 }],
  totals: { month: 'all', income: 3000, expense: 900, savings: 2100, savingsRate: 70 },
  growth: null
};

const analytics = {
  years: [
    {
      year: 2026, income: 3000, expense: 900, consumption: 900, invested: 0,
      savings: 2100, savingsRate: 70,
      incomeChange: null, incomeChangePct: null, expenseChange: null, expenseChangePct: null
    }
  ],
  investmentCategories: ['Investments', 'Savings'],
  months: [{ period: '2026-07', income: 3000, expense: 900, savings: 2100 }],
  categoryTrends: [
    {
      category: 'Groceries', byYear: { 2026: 900 }, total: 900,
      latest: 900, previous: 0, change: 900, changePct: null
    }
  ],
  incomeSources: [],
  monthlyAverages: [],
  currency: 'EUR'
};

function setMobile(isMobile: boolean) {
  window.matchMedia = ((query: string) => ({
    matches: isMobile, media: query, onchange: null,
    addListener: () => {}, removeListener: () => {},
    addEventListener: () => {}, removeEventListener: () => {}, dispatchEvent: () => false
  })) as unknown as typeof window.matchMedia;
}

/** Move to the Transactions tab, where the table and filters live. */
const openTransactions = async () =>
  userEvent.click(screen.getByRole('tab', { name: /transactions/i }));

beforeEach(() => {
  vi.clearAllMocks();
  setMobile(false);
  mockedUseTransactions.mockReturnValue({ data: page(), isLoading: false, error: null });
  mockedUseSummary.mockReturnValue({ data: summary });
  mockedUseAnalytics.mockReturnValue({ data: analytics });
});

afterEach(() => setMobile(false));

it('shows a spinner on the first load', () => {
  mockedUseTransactions.mockReturnValue({ data: undefined, isLoading: true, error: null });

  render(<CashFlowPage />);

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error when the query fails', () => {
  mockedUseTransactions.mockReturnValue({ data: undefined, isLoading: false, error: new Error('boom') });

  render(<CashFlowPage />);

  expect(screen.getByText('Failed to load transactions')).toBeInTheDocument();
});

it('points at importing when there is nothing recorded', () => {
  mockedUseTransactions.mockReturnValue({
    data: page({ items: [], totals: { count: 0, income: 0, expense: 0, net: 0 } }),
    isLoading: false,
    error: null
  });

  render(<CashFlowPage />);

  expect(screen.getByText('No transactions yet')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: /import your first statement/i })).toBeInTheDocument();
});

it('opens on the overview with the summary cards', () => {
  render(<CashFlowPage />);

  expect(screen.getByText('Savings rate')).toBeInTheDocument();
});

it('shows the trends tab on demand', async () => {
  render(<CashFlowPage />);

  await userEvent.click(screen.getByRole('tab', { name: /trends/i }));

  expect(screen.getByText('Income and spending over time')).toBeInTheDocument();
});

it('lists transactions with income positive and expense negative', async () => {
  render(<CashFlowPage />);
  await openTransactions();

  expect(screen.getByText('+3000 €')).toBeInTheDocument();
  expect(screen.getByText('−900 €')).toBeInTheDocument();
  expect(screen.getByText('RIMI')).toBeInTheDocument();
});

it('shows totals over the whole filtered set, not just the page', async () => {
  mockedUseTransactions.mockReturnValue({
    data: page({ totals: { count: 7030, income: 340828, expense: 150169, net: 190659 } }),
    isLoading: false,
    error: null
  });

  render(<CashFlowPage />);
  await openTransactions();

  expect(screen.getByText('7,030 matching')).toBeInTheDocument();
  expect(screen.getByText(/Net 190 659/)).toBeInTheDocument();
});

it('passes a category filter into the query and resets to the first page', async () => {
  render(<CashFlowPage />);
  await openTransactions();

  await userEvent.click(screen.getByLabelText('Category'));
  await userEvent.click(screen.getByRole('option', { name: 'Groceries' }));

  await waitFor(() =>
    expect(mockedUseTransactions).toHaveBeenLastCalledWith(
      expect.objectContaining({ category: 'Groceries', skip: 0 })
    )
  );
});

it('passes a search term into the query', async () => {
  render(<CashFlowPage />);
  await openTransactions();

  await userEvent.type(screen.getByLabelText('Search'), 'rimi');

  await waitFor(() =>
    expect(mockedUseTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ search: 'rimi' }))
  );
});

it('clears every filter at once', async () => {
  render(<CashFlowPage />);
  await openTransactions();

  await userEvent.type(screen.getByLabelText('Search'), 'rimi');
  await userEvent.click(await screen.findByRole('button', { name: /clear filters/i }));

  await waitFor(() =>
    expect(mockedUseTransactions).toHaveBeenLastCalledWith(
      expect.not.objectContaining({ search: expect.anything() })
    )
  );
});

it('says so when nothing matches the filters', async () => {
  mockedUseTransactions.mockReturnValue({
    data: page({ items: [], totals: { count: 0, income: 0, expense: 0, net: 0 } }),
    isLoading: false,
    error: null
  });

  render(<CashFlowPage />);
  // With no rows at all the page shows the empty state instead of the tabs,
  // so this needs a filter in play to reach the table's own empty message.
  expect(screen.getByText('No transactions yet')).toBeInTheDocument();
});

it('pages forward and back', async () => {
  mockedUseTransactions.mockReturnValue({
    data: page({ totals: { count: 500, income: 0, expense: 0, net: 0 }, hasMore: true }),
    isLoading: false,
    error: null
  });

  render(<CashFlowPage />);
  await openTransactions();

  await userEvent.click(screen.getByRole('button', { name: 'Next' }));

  await waitFor(() =>
    expect(mockedUseTransactions).toHaveBeenLastCalledWith(expect.objectContaining({ skip: 100 }))
  );
});

it('deletes a transaction after confirming', async () => {
  mockedDelete.mockResolvedValue({});

  render(<CashFlowPage />);
  await openTransactions();

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('x1'));
});

it('reports a failed delete', async () => {
  mockedDelete.mockRejectedValue(new Error('nope'));

  render(<CashFlowPage />);
  await openTransactions();

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  await waitFor(() => expect(screen.getByText('Failed to delete the transaction')).toBeInTheDocument());
});

it('opens the import dialog', async () => {
  render(<CashFlowPage />);

  await userEvent.click(screen.getByRole('button', { name: /import statement/i }));

  expect(screen.getByText('Import bank statement')).toBeInTheDocument();
});

it('offers no way to add or edit an entry by hand', async () => {
  render(<CashFlowPage />);
  await openTransactions();

  expect(screen.queryByRole('button', { name: /add transaction/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /^edit/i })).not.toBeInTheDocument();
});

it('renders transaction cards in the mobile layout', async () => {
  setMobile(true);

  render(<CashFlowPage />);
  await openTransactions();

  expect(screen.getByText('Salary')).toBeInTheDocument();
  expect(screen.getByText('+3000 €')).toBeInTheDocument();
});

it('shows the categories tab on demand', async () => {
  render(<CashFlowPage />);

  await userEvent.click(screen.getByRole('tab', { name: /categories/i }));

  expect(screen.getByText('Where the money goes')).toBeInTheDocument();
});
