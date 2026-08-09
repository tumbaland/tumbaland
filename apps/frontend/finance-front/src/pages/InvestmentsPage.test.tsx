import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', () => ({
  useTenantFilter: () => 'g1'
}));

vi.mock('../hooks/useHoldings', () => ({ useHoldings: vi.fn() }));
vi.mock('../hooks/useTrackedTicker', () => ({ useTrackedTickers: vi.fn() }));

// The plan's ticker allowance feeds the meter on the tickers tab. Stubbed at
// the query, so the page needs no QueryClientProvider.
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));
vi.mock('../services/entitlementsService', () => ({ getMyEntitlements: vi.fn() }));
vi.mock('../config/ConfigProvider', () => ({
  getGlobalConfig: () => ({ SHELL_FRONT_URL: 'http://shell.test' })
}));

vi.mock('../components/investments/HoldingsTab', () => ({
  default: ({ notify }: { notify: (m: string, s: 'success' | 'error') => void }) => (
    <div>
      holdings tab
      <button onClick={() => notify('saved', 'success')}>notify success</button>
    </div>
  )
}));
vi.mock('../components/investments/TickersTab', () => ({
  default: ({ tickerLimit, meteredTickers }: { tickerLimit?: number; meteredTickers?: number }) => (
    <div>tickers tab {meteredTickers ?? '-'}/{tickerLimit ?? '-'}</div>
  )
}));

import { useQuery } from '@tanstack/react-query';
import { useHoldings } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import InvestmentsPage from './InvestmentsPage';

const mockedUseHoldings = useHoldings as unknown as ReturnType<typeof vi.fn>;
const mockedUseTrackedTickers = useTrackedTickers as unknown as ReturnType<typeof vi.fn>;
const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;

beforeEach(() => {
  mockedUseHoldings.mockReturnValue({ data: [{ _id: 'h1' }], isLoading: false });
  mockedUseTrackedTickers.mockReturnValue({ data: [{ _id: 't1' }, { _id: 't2' }], isLoading: false });
  mockedUseQuery.mockReturnValue({
    data: { limits: { meters: { trackedTickers: 3 } }, usage: { trackedTickers: 2 } }
  });
});

it('shows a spinner while the active tab\'s data is loading', () => {
  mockedUseHoldings.mockReturnValue({ data: [], isLoading: true });
  render(<InvestmentsPage />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('renders the holdings tab by default with counts in the tab labels', () => {
  render(<InvestmentsPage />);
  expect(screen.getByText('Holdings (1)')).toBeInTheDocument();
  expect(screen.getByText('Tracked tickers (2)')).toBeInTheDocument();
  expect(screen.getByText('holdings tab')).toBeInTheDocument();
});

it('switches to the tracked tickers tab', async () => {
  render(<InvestmentsPage />);
  await userEvent.click(screen.getByText('Tracked tickers (2)'));
  expect(screen.getByText(/tickers tab/)).toBeInTheDocument();
});

it('shows a snackbar notification raised by a child tab, and dismisses it', async () => {
  render(<InvestmentsPage />);
  await userEvent.click(screen.getByText('notify success'));
  expect(await screen.findByText('saved')).toBeInTheDocument();

  await userEvent.click(screen.getByLabelText(/close/i));
  await waitFor(() => expect(screen.queryByText('saved')).not.toBeInTheDocument());
});

it('auto-hides the snackbar after its duration elapses', async () => {
  vi.useFakeTimers({ shouldAdvanceTime: true });
  render(<InvestmentsPage />);
  await userEvent.setup({ advanceTimers: vi.advanceTimersByTime }).click(screen.getByText('notify success'));
  expect(screen.getByText('saved')).toBeInTheDocument();

  vi.advanceTimersByTime(4000);
  await waitFor(() => expect(screen.queryByText('saved')).not.toBeInTheDocument());
  vi.useRealTimers();
});

it('defaults holdings/tickers to empty arrays while their queries have no data yet', () => {
  mockedUseHoldings.mockReturnValue({ data: undefined, isLoading: false });
  mockedUseTrackedTickers.mockReturnValue({ data: undefined, isLoading: false });
  render(<InvestmentsPage />);
  expect(screen.getByText('Holdings (0)')).toBeInTheDocument();
  expect(screen.getByText('Tracked tickers (0)')).toBeInTheDocument();
});

it('passes the plan\'s ticker allowance and live usage to the tickers tab', async () => {
  render(<InvestmentsPage />);
  await userEvent.click(screen.getByText('Tracked tickers (2)'));
  expect(screen.getByText(/tickers tab 2\/3/)).toBeInTheDocument();
});

it('still renders the tab when entitlements could not be loaded', async () => {
  mockedUseQuery.mockReturnValue({ data: undefined });
  render(<InvestmentsPage />);
  await userEvent.click(screen.getByText('Tracked tickers (2)'));
  expect(screen.getByText(/tickers tab -\/-/)).toBeInTheDocument();
});
