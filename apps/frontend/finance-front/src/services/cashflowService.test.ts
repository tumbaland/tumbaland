import { vi } from 'vitest';
import {
  getTransactions,
  getCategories,
  getCashflowSummary,
  getAnalytics,
  importStatement,
  deleteTransaction
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
    mockFetchOnce({ success: true, data: { items: [], totals: {}, hasMore: false } });

    await getTransactions();

    expect(lastUrl()).toContain('/transactions');
    expect(lastUrl()).not.toContain('from=');
  });

  it('sends every filter it is given', async () => {
    mockFetchOnce({ success: true, data: { items: [], totals: {}, hasMore: false } });

    await getTransactions({
      groupId: 'g1',
      from: '2026-01-01',
      to: '2026-06-01',
      type: 'expense',
      category: 'Rent',
      search: 'rimi',
      limit: 50,
      skip: 100
    });

    const url = lastUrl();
    expect(url).toContain('groupId=g1');
    expect(url).toContain('from=2026-01-01');
    expect(url).toContain('to=2026-06-01');
    expect(url).toContain('type=expense');
    expect(url).toContain('category=Rent');
    expect(url).toContain('limit=50');
    expect(url).toContain('search=rimi');
    expect(url).toContain('skip=100');
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

  it('deletes a transaction', async () => {
    mockFetchOnce({ success: true });

    await deleteTransaction('x1');

    expect(lastUrl()).toContain('/transactions/x1');
    expect(lastInit().method).toBe('DELETE');
  });
});

describe('analytics and import', () => {
  it('reads the analytics report', async () => {
    mockFetchOnce({ success: true, data: { years: [] } });

    await getAnalytics('g1');

    expect(lastUrl()).toContain('/transactions/analytics');
    expect(lastUrl()).toContain('groupId=g1');
  });

  it('posts the statement as raw CSV, not JSON', async () => {
    mockFetchOnce({ success: true, data: { imported: 2, duplicates: 0 } });

    await importStatement('Kliendi konto;a\nrow', 'g1');

    const init = lastInit();
    expect(lastUrl()).toContain('/transactions/import');
    // Sent verbatim — JSON.stringify would quote it and escape every newline
    expect(init.body).toBe('Kliendi konto;a\nrow');
    expect((init.headers as Record<string, string>)['Content-Type']).toBe('text/csv');
  });

  it('omits the group when working personally', async () => {
    mockFetchOnce({ success: true, data: { imported: 0, duplicates: 0 } });

    await importStatement('csv');

    expect(lastUrl()).not.toContain('groupId=');
  });
});
