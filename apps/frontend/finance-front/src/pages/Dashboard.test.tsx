import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', () => ({
  useTenantFilter: () => undefined
}));

vi.mock('../hooks/useDashboard', () => ({
  useDashboard: vi.fn()
}));

import { useDashboard } from '../hooks/useDashboard';
import Dashboard from './Dashboard';

const mockedUseDashboard = useDashboard as unknown as ReturnType<typeof vi.fn>;

function renderPage() {
  return render(
    <MemoryRouter>
      <Dashboard />
    </MemoryRouter>
  );
}

it('shows a spinner while loading', () => {
  mockedUseDashboard.mockReturnValue({ isLoading: true, error: null, data: undefined });
  renderPage();
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows the error message when the query fails', () => {
  mockedUseDashboard.mockReturnValue({ isLoading: false, error: new Error('network down'), data: undefined });
  renderPage();
  expect(screen.getByText('network down')).toBeInTheDocument();
});

it('shows a generic error message when the error has none', () => {
  mockedUseDashboard.mockReturnValue({ isLoading: false, error: {}, data: undefined });
  renderPage();
  expect(screen.getByText('Failed to fetch dashboard data')).toBeInTheDocument();
});

it('shows the empty state when there is no net worth history', () => {
  mockedUseDashboard.mockReturnValue({
    isLoading: false,
    error: null,
    data: { netWorthHistory: [], kpis: {}, allocation: [], assetColors: {}, holdings: null }
  });
  renderPage();
  expect(screen.getByText('No data yet')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /go to net worth/i })).toHaveAttribute('href', '/net-worth');
});

it('renders KPIs, charts, and the holdings summary when data is present (singular "holding")', () => {
  mockedUseDashboard.mockReturnValue({
    isLoading: false,
    error: null,
    data: {
      netWorthHistory: [{ date: '2024-01-01', total: 1000, byClass: { Stocks: 1000 } }],
      kpis: { netWorth: 1000, asOf: null, monthChange: 0, monthChangePct: 0, yearChange: 0, yearChangePct: 0, totalGain: 0, totalGainPct: 0 },
      allocation: [],
      assetColors: {},
      holdings: { count: 1, totalValue: 1000, totalCost: 900, gain: 100, gainPct: 11 }
    }
  });
  renderPage();

  expect(screen.getByText('Investments · 1 holding')).toBeInTheDocument();
  expect(screen.getByRole('link', { name: /view holdings/i })).toHaveAttribute('href', '/investments');
});

it('pluralizes the holdings count and colors a loss red', () => {
  mockedUseDashboard.mockReturnValue({
    isLoading: false,
    error: null,
    data: {
      netWorthHistory: [{ date: '2024-01-01', total: 1000, byClass: {} }],
      kpis: { netWorth: 1000, asOf: null, monthChange: 0, monthChangePct: 0, yearChange: 0, yearChangePct: 0, totalGain: 0, totalGainPct: 0 },
      allocation: [],
      assetColors: {},
      holdings: { count: 3, totalValue: 900, totalCost: 1000, gain: -100, gainPct: -10 }
    }
  });
  renderPage();

  expect(screen.getByText('Investments · 3 holdings')).toBeInTheDocument();
});

it('omits the holdings card when holdings is null', () => {
  mockedUseDashboard.mockReturnValue({
    isLoading: false,
    error: null,
    data: {
      netWorthHistory: [{ date: '2024-01-01', total: 1000, byClass: {} }],
      kpis: { netWorth: 1000, asOf: null, monthChange: 0, monthChangePct: 0, yearChange: 0, yearChangePct: 0, totalGain: 0, totalGainPct: 0 },
      allocation: [],
      assetColors: {},
      holdings: null
    }
  });
  renderPage();

  expect(screen.queryByText(/Investments ·/)).not.toBeInTheDocument();
});
