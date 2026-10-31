import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import type { ComponentProps } from 'react';
import type TickerSearch from './TickerSearch';

const mockedCreateMutateAsync = vi.fn();
const mockedUpdateMutateAsync = vi.fn();
const mockedDeleteMutateAsync = vi.fn();

vi.mock('../../hooks/useTrackedTicker', () => ({
  useCreateTrackedTicker: () => ({ mutateAsync: mockedCreateMutateAsync, isPending: false }),
  useUpdateTrackedTicker: () => ({ mutateAsync: mockedUpdateMutateAsync, isPending: false }),
  useDeleteTrackedTicker: () => ({ mutateAsync: mockedDeleteMutateAsync, isPending: false })
}));

vi.mock('../../services/tickerPriceHistoryService', () => ({
  fetchAllTickerPriceHistory: vi.fn(),
  fetchTickerPriceHistory: vi.fn(),
  fetchWeeklyTickerPriceHistory: vi.fn(),
  // The tab shows how much provider quota is left; nothing here asserts on it,
  // so it resolves to a full day.
  getQuota: vi.fn().mockResolvedValue({ limit: 25, used: 0, remaining: 25, date: '2026-08-06' }),
  getTickerCoverage: vi.fn()
}));

vi.mock('./TickerSearch', () => ({
  default: ({ onSelect }: ComponentProps<typeof TickerSearch>) => (
    <button
      onClick={() =>
        onSelect({
          symbol: 'MSFT',
          name: 'Microsoft',
          type: 'Equity',
          region: 'United States',
          currency: 'USD',
          matchScore: '1.0000'
        })
      }
    >
      pick MSFT
    </button>
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

import {
  fetchAllTickerPriceHistory,
  fetchTickerPriceHistory,
  fetchWeeklyTickerPriceHistory,
  getTickerCoverage
} from '../../services/tickerPriceHistoryService';
import TickersTab from './TickersTab';
import { TrackedTicker } from '../../services/trackedTickerService';

const mockedFetchAll = fetchAllTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;
const mockedFetchLatest = fetchTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;
const mockedFetchWeekly = fetchWeeklyTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;
const mockedCoverage = getTickerCoverage as unknown as ReturnType<typeof vi.fn>;

/** Coverage as the API reports it: a deep weekly series and a fresh daily one. */
const coverageFor = (overrides: Record<string, unknown> = {}) => [
  {
    ticker: 'AAPL',
    daily: {
      count: 143,
      first: '2026-01-16T00:00:00.000Z',
      last: new Date().toISOString(),
      fetchedAt: '2026-08-11T01:00:07.000Z'
    },
    weekly: {
      count: 622,
      first: '2015-01-20T00:00:00.000Z',
      last: new Date().toISOString(),
      fetchedAt: '2026-08-11T01:00:07.000Z'
    },
    ...overrides
  },
  {
    ticker: 'BND',
    daily: { count: 0, first: null, last: null, fetchedAt: null },
    weekly: { count: 0, first: null, last: null, fetchedAt: null }
  }
];

/**
 * A session date as the table renders it: the viewer's locale format, held in
 * UTC. Derived rather than hardcoded so the assertions hold under any locale
 * the test runner happens to have.
 */
const asShownDate = (iso: string) =>
  new Date(iso).toLocaleDateString(undefined, {
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    timeZone: 'UTC'
  });

/** Opens the sync dialog for the first ticker in the list. */
async function openSync() {
  const syncButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="SyncIcon"]'));
  await userEvent.click(syncButtons[0]);
  return screen.findByRole('dialog');
}

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

const tickers: TrackedTicker[] = [
  {
    _id: 't1',
    ticker: 'AAPL',
    displayName: 'Apple',
    currency: 'USD',
    isActive: true,
    dateAdded: '2024-01-01T00:00:00.000Z'
  },
  // No currency and no dateAdded: both render as an em dash
  { _id: 't2', ticker: 'BND', displayName: 'Vanguard Bond', isActive: false }
];

// The fixtures and the component both read "now": the newest bar is dated
// today, and the years of weekly history run up to it. A real clock let
// "11.6 yrs" drift to 11.7 a month later. Only Date is faked, so timers, user
// events and findBy* keep running in real time.
const NOW = new Date('2026-08-12T09:00:00.000Z');

beforeEach(() => {
  vi.useFakeTimers({ toFake: ['Date'] });
  vi.setSystemTime(NOW);
  vi.clearAllMocks();
  mockedCoverage.mockResolvedValue(coverageFor());
});

afterEach(() => {
  vi.useRealTimers();
});

it('shows an empty state when there are no tracked tickers', () => {
  render(<TickersTab tickers={[]} notify={vi.fn()} />);
  expect(screen.getByText(/no tracked tickers/i)).toBeInTheDocument();
});

it('renders ticker rows with active/paused status and a currency or a dash', () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Active')).toBeInTheDocument();
  expect(screen.getByText('Paused')).toBeInTheDocument();
  expect(screen.getByText('USD')).toBeInTheDocument();
  // BND has no currency, so its cell dashes. Scoped to the row rather than
  // counted across the table: the freshness column also dashes until coverage
  // loads, and a bare count would pin that timing rather than this behaviour.
  // (The date a ticker was added moved into the sync dialog, where it explains
  // a short series instead of competing for width here.)
  const bnd = screen.getByText('BND').closest('tr')!;
  expect(within(bnd).getAllByText('—').length).toBeGreaterThan(0);
});

it('shows when the instrument started being tracked, in the sync dialog', async () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  await openSync();

  expect(screen.getByText(/tracked since 2024-01-01/)).toBeInTheDocument();
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
    // Taken from the search result, so prices convert correctly
    currency: 'USD',
    isin: '',
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

it('names the plan limit when the add is refused with a 402', async () => {
  mockedCreateMutateAsync.mockRejectedValue({
    status: 402,
    body: { meter: 'trackedTickers', limit: 3, planCode: 'free', upgradeTo: 'support' }
  });
  const notify = vi.fn();
  render(<TickersTab tickers={[]} notify={notify} />);

  await userEvent.click(screen.getByRole('button', { name: /track ticker/i }));
  await userEvent.click(screen.getByText('pick MSFT'));
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(notify).toHaveBeenCalledWith(expect.stringContaining('tracked tickers limit (3)'), 'error');
});

it('draws the usage meter against the billed count, not the visible rows', () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} tickerLimit={3} meteredTickers={2} />);

  // The group's pool, not this context's two rows.
  expect(screen.getByText('2 of 3')).toBeInTheDocument();
});

it('draws no meter when entitlements could not be loaded', () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  expect(screen.queryByText(/Tracked tickers/)).not.toBeInTheDocument();
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
    data: { ticker: 'AAPL', displayName: 'Apple', currency: 'USD', isin: '', description: '', isActive: false }
  });
  expect(notify).toHaveBeenCalledWith('Ticker updated', 'success');
  expect(screen.queryByText(/will move to/)).not.toBeInTheDocument();
});

it('shows the ISIN of each ticker, with a dash where none is set', () => {
  render(
    <TickersTab
      tickers={[{ ...tickers[0], isin: 'IE00B3XXRP09' }, { ...tickers[1], isin: undefined }]}
      notify={vi.fn()}
    />
  );

  expect(screen.getByRole('columnheader', { name: 'ISIN' })).toBeInTheDocument();
  expect(screen.getByText('IE00B3XXRP09')).toBeInTheDocument();
});

it('saves the ISIN a bank names the fund by, uppercased and without spaces', async () => {
  mockedUpdateMutateAsync.mockResolvedValue({});
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);
  await userEvent.type(screen.getByLabelText('ISIN'), 'ie00b3 xxrp09');
  await userEvent.click(screen.getByRole('button', { name: 'Update' }));

  expect(mockedUpdateMutateAsync).toHaveBeenCalledWith({
    id: 't1',
    data: expect.objectContaining({ isin: 'IE00B3XXRP09' })
  });
});

it('says what a symbol change carries over, and reports the rename', async () => {
  mockedUpdateMutateAsync.mockResolvedValue({});
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);
  const symbol = screen.getByLabelText(/^Ticker/);
  await userEvent.clear(symbol);
  await userEvent.type(symbol, 'aapl.dex');

  expect(screen.getByText('Price history, holdings and trades for AAPL will move to AAPL.DEX.')).toBeInTheDocument();

  mockedCoverage.mockClear();
  await userEvent.click(screen.getByRole('button', { name: 'Update' }));

  expect(mockedUpdateMutateAsync).toHaveBeenCalledWith({
    id: 't1',
    data: expect.objectContaining({ ticker: 'AAPL.DEX' })
  });
  expect(notify).toHaveBeenCalledWith('Renamed AAPL to AAPL.DEX', 'success');
  // Coverage is keyed by symbol, so it is fetched again under the new one.
  expect(mockedCoverage).toHaveBeenCalled();
});

it('shows why a rename was refused when the new symbol is already in use', async () => {
  const message = 'AAPL.DEX is already tracked or held here. Remove it first, then rename AAPL.';
  mockedUpdateMutateAsync.mockRejectedValue(Object.assign(new Error(message), { status: 409 }));
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);
  await userEvent.type(screen.getByLabelText(/^Ticker/), '.DEX');
  await userEvent.click(screen.getByRole('button', { name: 'Update' }));

  expect(notify).toHaveBeenCalledWith(message, 'error');
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

it('fetches daily price history from the sync dialog and notifies on success', async () => {
  mockedFetchAll.mockResolvedValue(undefined);
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  await openSync();
  await userEvent.click(screen.getByRole('button', { name: /last ~100 days/i }));

  expect(mockedFetchAll).toHaveBeenCalledWith('AAPL');
  expect(notify).toHaveBeenCalledWith('Daily price history fetched for AAPL', 'success');
});

it('fetches the full weekly series, reporting how many closes arrived', async () => {
  mockedFetchWeekly.mockResolvedValue({ ticker: 'AAPL', recordsCount: 622 });
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  await openSync();
  await userEvent.click(screen.getByRole('button', { name: /full weekly history/i }));

  expect(mockedFetchWeekly).toHaveBeenCalledWith('AAPL');
  expect(notify).toHaveBeenCalledWith('Fetched 622 weekly closes for AAPL', 'success');
});

it('fetches just the latest close', async () => {
  mockedFetchLatest.mockResolvedValue(undefined);
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  await openSync();
  await userEvent.click(screen.getByRole('button', { name: /latest price/i }));

  expect(mockedFetchLatest).toHaveBeenCalledWith('AAPL');
  expect(notify).toHaveBeenCalledWith('Latest price fetched for AAPL', 'success');
});

it('notifies with a shared-allowance hint when a sync fails', async () => {
  mockedFetchAll.mockRejectedValue(new Error('fail'));
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  await openSync();
  await userEvent.click(screen.getByRole('button', { name: /last ~100 days/i }));

  expect(notify).toHaveBeenCalledWith(expect.stringContaining('Failed to sync AAPL'), 'error');
});

it('shows how much history is stored and when it was last updated', async () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  // The table dates the newest bar per ticker...
  expect(await screen.findAllByText(asShownDate(new Date().toISOString()))).not.toHaveLength(0);
  // ...and flags the instrument with no long history as actionable.
  expect(screen.getByText('11.6 yrs')).toBeInTheDocument();
  expect(screen.getByText('not fetched')).toBeInTheDocument();

  await openSync();
  expect(screen.getByText(/622 closes/)).toBeInTheDocument();
  expect(screen.getByText(/143 closes/)).toBeInTheDocument();
});

it('separates when we last fetched from the session we last got', async () => {
  // One column pretending to be both is what made a healthy nightly job read
  // as three days stale: over a weekend the fetch time moves and the session
  // date does not, and only showing them apart makes that legible.
  mockedCoverage.mockResolvedValue([
    {
      ticker: 'AAPL',
      daily: {
        count: 143,
        first: '2026-01-16T00:00:00.000Z',
        last: '2026-08-07T00:00:00.000Z',
        fetchedAt: '2026-08-11T01:00:07.000Z'
      },
      weekly: { count: 0, first: null, last: null, fetchedAt: null }
    }
  ]);
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  const cell = await screen.findByText(asShownDate('2026-08-07T00:00:00.000Z'));
  const row = cell.closest('tr') as HTMLElement;

  // The fetch is an instant, reported to the second, and it is a later moment
  // than the session it retrieved.
  expect(within(row).getByText(/\d{1,2}:\d{2}:\d{2}/)).toBeInTheDocument();

  // No relative phrasing survives anywhere in the row. Scoped to the row
  // because "today" legitimately appears in the quota line above the table.
  expect(within(row).queryByText(/ago|last close|up to date|behind|yesterday|today/i)).toBeNull();
});

it('flags a daily series that has stopped updating', async () => {
  mockedCoverage.mockResolvedValue([
    {
      ticker: 'AAPL',
      daily: {
        count: 143,
        first: '2026-01-16T00:00:00.000Z',
        last: '2026-06-04T00:00:00.000Z',
        fetchedAt: '2026-08-11T01:00:07.000Z'
      },
      weekly: { count: 0, first: null, last: null, fetchedAt: null }
    },
    {
      ticker: 'BND',
      daily: { count: 0, first: null, last: null, fetchedAt: null },
      weekly: { count: 0, first: null, last: null, fetchedAt: null }
    }
  ]);
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  // Dated rather than "no data": the difference between a broken job and a new
  // instrument is the whole point of showing this, and the date says which
  // session it stopped at instead of leaving the reader to work it out.
  expect(await screen.findByText(asShownDate('2026-06-04T00:00:00.000Z'))).toBeInTheDocument();
  expect(screen.getByText('no data')).toBeInTheDocument(); // the untouched BND row
});

it('recommends the weekly fetch when no long history is stored', async () => {
  mockedCoverage.mockResolvedValue([
    {
      ticker: 'AAPL',
      daily: {
        count: 143,
        first: '2026-01-16T00:00:00.000Z',
        last: new Date().toISOString(),
        fetchedAt: '2026-08-11T01:00:07.000Z'
      },
      weekly: { count: 0, first: null, last: null, fetchedAt: null }
    }
  ]);
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  await openSync();

  expect(screen.getByText(/No long history stored for this instrument/i)).toBeInTheDocument();
});

it('renders the table even when coverage cannot be loaded', async () => {
  mockedCoverage.mockRejectedValue(new Error('offline'));
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  expect(await screen.findByText('Apple')).toBeInTheDocument();
});

it('opens and closes the price history modal', async () => {
  render(<TickersTab tickers={tickers} notify={vi.fn()} />);

  const historyButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="ShowChartIcon"]'));
  await userEvent.click(historyButtons[0]);
  expect(screen.getByText('history for AAPL')).toBeInTheDocument();

  await userEvent.click(screen.getByText('close history'));
  expect(screen.queryByText('history for AAPL')).not.toBeInTheDocument();
});

it('renders ticker cards in the mobile layout, supporting fetch/edit/delete/history from there', async () => {
  setMobile(true);
  mockedFetchAll.mockResolvedValue(undefined);
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  expect(screen.getByText('Apple')).toBeInTheDocument();
  expect(screen.getByText('Active')).toBeInTheDocument();

  const historyButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="ShowChartIcon"]'));
  await userEvent.click(historyButtons[0]);
  expect(screen.getByText('history for AAPL')).toBeInTheDocument();
  await userEvent.click(screen.getByText('close history'));

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);
  expect(screen.getByLabelText(/^Ticker/)).toHaveValue('AAPL');
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  await waitFor(() => expect(screen.queryByRole('dialog')).not.toBeInTheDocument());

  // Sync last: it opens a dialog, and a modal left open blocks every card
  // interaction behind it.
  await openSync();
  await userEvent.click(screen.getByRole('button', { name: /last ~100 days/i }));
  expect(mockedFetchAll).toHaveBeenCalledWith('AAPL');
});

it('cancels the delete confirmation without deleting', async () => {
  const notify = vi.fn();
  render(<TickersTab tickers={tickers} notify={notify} />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(await screen.findByRole('button', { name: 'Cancel' }));

  expect(mockedDeleteMutateAsync).not.toHaveBeenCalled();
  await waitFor(() => expect(screen.queryByText('Stop tracking ticker')).not.toBeInTheDocument());
});

it('cancels the add-ticker dialog', async () => {
  render(<TickersTab tickers={[]} notify={vi.fn()} />);

  await userEvent.click(screen.getByRole('button', { name: /track ticker/i }));
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));

  await waitFor(() => expect(screen.queryByRole('heading', { name: 'Track ticker' })).not.toBeInTheDocument());
});
