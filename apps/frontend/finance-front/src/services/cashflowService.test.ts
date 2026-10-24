import { vi } from 'vite-plus/test';
import {
  getTransactions,
  getCategories,
  getCashflowSummary,
  getAnalytics,
  getRecurring,
  importStatement,
  deleteTransaction,
  exportTransactions,
  saveBlob
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
    expect(new Headers(init.headers).get('Content-Type')).toBe('text/csv');
  });

  it('omits the group when working personally', async () => {
    mockFetchOnce({ success: true, data: { imported: 0, duplicates: 0 } });

    await importStatement('csv');

    expect(lastUrl()).not.toContain('groupId=');
  });
});

describe('export', () => {
  const mockCsvOnce = (disposition: string | null) =>
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({
      ok: true,
      status: 200,
      blob: async () => new Blob(['id;category\n']),
      headers: { get: () => disposition }
    } as unknown as Response);

  it('carries every filter the table is showing', async () => {
    mockCsvOnce('attachment; filename="transactions_uncategorised.csv"');

    await exportTransactions({
      groupId: 'g1',
      from: '2025-01-01',
      to: '2025-12-31',
      type: 'expense',
      category: 'Uncategorised',
      search: 'rimi'
    });

    const url = lastUrl();
    expect(url).toContain('/transactions/export?');
    expect(url).toContain('groupId=g1');
    expect(url).toContain('from=2025-01-01');
    expect(url).toContain('to=2025-12-31');
    expect(url).toContain('type=expense');
    expect(url).toContain('category=Uncategorised');
    expect(url).toContain('search=rimi');
  });

  it('sends the session cookie, since the file is per user', async () => {
    mockCsvOnce('attachment; filename="transactions_all.csv"');

    await exportTransactions();

    expect(lastInit().credentials).toBe('include');
  });

  it('takes the file name the server chose', async () => {
    mockCsvOnce('attachment; filename="transactions_uncategorised.csv"');

    const { filename } = await exportTransactions({ category: 'Uncategorised' });

    expect(filename).toBe('transactions_uncategorised.csv');
  });

  it('falls back to a plain name when the header says nothing', async () => {
    mockCsvOnce(null);

    const { filename } = await exportTransactions();

    expect(filename).toBe('transactions.csv');
  });

  it('raises the status when the export is refused', async () => {
    (global.fetch as ReturnType<typeof vi.fn>).mockResolvedValueOnce({ ok: false, status: 400 } as Response);

    await expect(exportTransactions()).rejects.toThrow('Export failed: 400');
  });
});

describe('saveBlob', () => {
  it('clicks a download link and cleans up after itself', () => {
    const createObjectURL = vi.fn().mockReturnValue('blob:x');
    const revokeObjectURL = vi.fn();
    Object.assign(URL, { createObjectURL, revokeObjectURL });
    const click = vi.fn();
    const link = { click, remove: vi.fn(), href: '', download: '' } as unknown as HTMLAnchorElement;
    vi.spyOn(document, 'createElement').mockReturnValueOnce(link);
    vi.spyOn(document.body, 'appendChild').mockImplementationOnce((n) => n);

    saveBlob(new Blob(['a']), 'transactions.csv');

    expect(link.download).toBe('transactions.csv');
    expect(click).toHaveBeenCalled();
    // Leaving the object URL alive holds the whole file in memory
    expect(revokeObjectURL).toHaveBeenCalledWith('blob:x');
  });
});

describe('declaring the file type on import', () => {
  it('sends no format when none is chosen, leaving the server to detect', async () => {
    mockFetchOnce({ success: true, data: { imported: 1 } });

    await importStatement('csv');

    expect(lastUrl()).not.toContain('format=');
  });

  it('sends the declared format alongside the group', async () => {
    mockFetchOnce({ success: true, data: { imported: 1 } });

    await importStatement('csv', 'g1', 'pensionikeskus');

    expect(lastUrl()).toContain('groupId=g1');
    expect(lastUrl()).toContain('format=pensionikeskus');
  });

  it('sends a format with no group', async () => {
    mockFetchOnce({ success: true, data: { imported: 1 } });

    await importStatement('csv', undefined, 'seb');

    expect(lastUrl()).toContain('format=seb');
    expect(lastUrl()).not.toContain('groupId=');
  });

  it('sends the bytes it was handed rather than re-encoding them', async () => {
    // A Latin-1 file decoded here would reach the server already corrupted
    mockFetchOnce({ success: true, data: { imported: 1 } });
    const bytes = new TextEncoder().encode('Osakute').buffer;

    await importStatement(bytes);

    expect(lastInit().body).toBeInstanceOf(Uint8Array);
    expect(new TextDecoder().decode(lastInit().body as Uint8Array)).toBe('Osakute');
  });
});

describe('recurring payments', () => {
  const report = {
    from: '2024-09-01',
    to: '2026-09-03',
    monthlyTotal: 0,
    yearlyTotal: 0,
    lapsedCount: 0,
    payments: []
  };

  it('fetches the personal scope with no window override', async () => {
    mockFetchOnce({ success: true, data: report });

    const result = await getRecurring();

    expect(lastUrl()).toContain('/transactions/recurring');
    expect(lastUrl()).not.toContain('groupId');
    expect(result).toEqual(report);
  });

  it('passes the group and window through', async () => {
    mockFetchOnce({ success: true, data: report });

    await getRecurring('g1', 12);

    expect(lastUrl()).toContain('groupId=g1');
    expect(lastUrl()).toContain('months=12');
  });
});
