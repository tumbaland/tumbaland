import { vi } from 'vitest';
import {
  getTransactions,
  getCategories,
  getCashflowSummary,
  addTransaction,
  updateTransaction,
  deleteTransaction,
  getBudgets,
  addBudget,
  updateBudget,
  deleteBudget
} from './cashflowService';

function mockFetchOnce(body: unknown) {
  (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
    ok: true,
    status: 200,
    json: async () => body
  } as Response);
}

const lastUrl = () => String((global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][0]);
const lastInit = () => (global.fetch as ReturnType<typeof vi.fn>).mock.calls[0][1] as RequestInit;

describe('transactions', () => {
  it('fetches with no filters', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getTransactions();

    expect(lastUrl()).toContain('/transactions');
    expect(lastUrl()).not.toContain('from=');
  });

  it('sends every filter it is given', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getTransactions({
      groupId: 'g1',
      from: '2026-01-01',
      to: '2026-06-01',
      type: 'expense',
      category: 'Rent',
      limit: 50
    });

    const url = lastUrl();
    expect(url).toContain('groupId=g1');
    expect(url).toContain('from=2026-01-01');
    expect(url).toContain('to=2026-06-01');
    expect(url).toContain('type=expense');
    expect(url).toContain('category=Rent');
    expect(url).toContain('limit=50');
  });

  it('reads the categories in use', async () => {
    mockFetchOnce({ success: true, data: ['Rent', 'Travel'] });

    expect(await getCategories()).toEqual(['Rent', 'Travel']);
    expect(lastUrl()).toContain('/transactions/categories');
  });

  it('passes the group when reading categories', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getCategories('g1');

    expect(lastUrl()).toContain('groupId=g1');
  });

  it('reads the summary with an explicit window', async () => {
    mockFetchOnce({ success: true, data: { months: [] } });

    await getCashflowSummary('g1', 6);

    expect(lastUrl()).toContain('/transactions/summary');
    expect(lastUrl()).toContain('months=6');
    expect(lastUrl()).toContain('groupId=g1');
  });

  it('omits the window when not given', async () => {
    mockFetchOnce({ success: true, data: { months: [] } });

    await getCashflowSummary();

    expect(lastUrl()).not.toContain('months=');
  });

  it('posts a new transaction', async () => {
    mockFetchOnce({ success: true, data: {} });

    await addTransaction({ date: '2026-01-05', amount: 40, type: 'expense', category: 'Rent' });

    expect(JSON.parse(lastInit().body as string)).toMatchObject({ amount: 40, type: 'expense' });
  });

  it('puts an updated transaction', async () => {
    mockFetchOnce({ success: true, data: {} });

    await updateTransaction('x1', { amount: 60 });

    expect(lastUrl()).toContain('/transactions/x1');
  });

  it('deletes a transaction', async () => {
    mockFetchOnce({ success: true });

    await deleteTransaction('x1');

    expect(lastUrl()).toContain('/transactions/x1');
    expect(lastInit().method).toBe('DELETE');
  });
});

describe('budgets', () => {
  it('reads budgets for the caller', async () => {
    mockFetchOnce({ success: true, data: [{ category: 'Rent', amount: 800 }] });

    expect(await getBudgets()).toHaveLength(1);
    expect(lastUrl()).toContain('/budgets');
  });

  it('passes the group when reading budgets', async () => {
    mockFetchOnce({ success: true, data: [] });

    await getBudgets('g1');

    expect(lastUrl()).toContain('groupId=g1');
  });

  it('posts a new budget', async () => {
    mockFetchOnce({ success: true, data: {} });

    await addBudget({ category: 'Rent', amount: 800 });

    expect(JSON.parse(lastInit().body as string)).toMatchObject({ category: 'Rent', amount: 800 });
  });

  it('puts an updated budget', async () => {
    mockFetchOnce({ success: true, data: {} });

    await updateBudget('b1', { amount: 900 });

    expect(lastUrl()).toContain('/budgets/b1');
  });

  it('deletes a budget', async () => {
    mockFetchOnce({ success: true });

    await deleteBudget('b1');

    expect(lastUrl()).toContain('/budgets/b1');
    expect(lastInit().method).toBe('DELETE');
  });
});
