import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import CashflowCard from './CashflowCard';
import { DashboardData } from '../services/dashboardService';

type Cashflow = NonNullable<DashboardData['cashflow']>;

const totals = (over = {}) => ({
  income: 40000,
  expense: 16000,
  consumption: 16000,
  invested: 0,
  divested: 0,
  savings: 24000,
  savingsRate: 60,
  months: 12,
  from: '2025-09',
  to: '2026-08',
  ...over
});

const base: Cashflow = {
  trailing: totals(),
  previous: totals({ income: 30000, consumption: 14000, savings: 16000, from: '2024-09', to: '2025-08' }),
  growth: {
    from: '2026-07',
    to: '2026-08',
    netWorthChange: 2000,
    contributions: 1500,
    marketGrowth: 500,
    complete: true
  }
} as Cashflow;

const renderCard = (cashflow: Cashflow = base, currency?: string) =>
  render(
    <MemoryRouter>
      <CashflowCard cashflow={cashflow} currency={currency} />
    </MemoryRouter>
  );

it('is built on a rolling year, and says so', () => {
  // The current month is usually half-imported, so a card keyed to it would
  // report a collapse in income every time
  renderCard();

  expect(screen.getByText(/Last 12 months · Sept 2025 – Aug 2026/)).toBeInTheDocument();
});

it('shows income, spending, kept and the rate', () => {
  renderCard();

  expect(screen.getByText('40 000 €')).toBeInTheDocument();
  expect(screen.getByText('16 000 €')).toBeInTheDocument();
  expect(screen.getByText('24 000 €')).toBeInTheDocument();
  expect(screen.getByText('+60.0%')).toBeInTheDocument();
});

it('splits income into salary, what the assets paid and other', () => {
  renderCard({
    ...base,
    trailing: totals({ income: 40000, incomeBy: { salary: 37000, dividends: 1200, interest: 60, other: 1740 } })
  });

  expect(screen.getByText('Salary')).toBeInTheDocument();
  expect(screen.getByText('37 000 €')).toBeInTheDocument();
  expect(screen.getByText('From assets')).toBeInTheDocument();
  // dividends and interest together
  expect(screen.getByText('1260 €')).toBeInTheDocument();
  expect(screen.getByText('Other')).toBeInTheDocument();
  expect(screen.getByText('1740 €')).toBeInTheDocument();
});

it('leaves out the other line when nothing else came in', () => {
  renderCard({
    ...base,
    trailing: totals({ income: 40000, incomeBy: { salary: 39000, dividends: 1000, interest: 0, other: 0 } })
  });

  expect(screen.getByText('From assets')).toBeInTheDocument();
  expect(screen.queryByText('Other')).not.toBeInTheDocument();
});

it('shows no split against a service that does not send one', () => {
  renderCard();

  expect(screen.queryByText('Salary')).not.toBeInTheDocument();
  expect(screen.queryByText('From assets')).not.toBeInTheDocument();
});

it('compares what was kept against the prior year', () => {
  // 16 000 → 24 000
  renderCard();

  expect(screen.getByText('+50.0% vs prior year')).toBeInTheDocument();
});

it('omits the comparison when there is no prior year', () => {
  renderCard({ ...base, previous: null });

  expect(screen.queryByText(/vs prior year/)).not.toBeInTheDocument();
});

it('notes money moved into assets separately from spending', () => {
  renderCard({ ...base, trailing: totals({ invested: 5000 }) });

  expect(screen.getByText('5000 € invested')).toBeInTheDocument();
});

it('shows a dash when there is no income to compute a rate from', () => {
  renderCard({ ...base, trailing: totals({ income: 0, savingsRate: null }) });

  expect(screen.getByText('—')).toBeInTheDocument();
});

it('splits the net-worth change into contributions and market movement', () => {
  renderCard();

  expect(screen.getByText(/Net worth moved 2000 € from Jul 2026 to Aug 2026/)).toBeInTheDocument();
  expect(screen.getByText('You contributed')).toBeInTheDocument();
  expect(screen.getByText('+500 €')).toBeInTheDocument();
});

it('gives the market a colour of its own instead of leaving it as the empty part of the bar', () => {
  renderCard();

  // The track behind the contributed share is the market's share: indigo
  expect(getComputedStyle(screen.getByRole('progressbar')).backgroundColor).toBe('rgb(102, 126, 234)');
});

it('shows a market loss in red', () => {
  renderCard({
    ...base,
    growth: { from: '2026-07', to: '2026-08', netWorthChange: 1000, contributions: 1500, marketGrowth: -500, complete: true }
  } as Cashflow);

  expect(getComputedStyle(screen.getByRole('progressbar')).backgroundColor).toBe('rgb(239, 68, 68)');
});

it('shows no split at all when the server withheld one', () => {
  // The dashboard service only sends a complete split, so there is nothing
  // here to caveat — the absence is the message
  renderCard({ ...base, growth: null });

  expect(screen.queryByText('You contributed')).not.toBeInTheDocument();
  expect(screen.getByText('Cash Flow')).toBeInTheDocument();
});

it('formats amounts in the given currency', () => {
  renderCard(base, 'USD');

  expect(screen.getByText('40 000 $')).toBeInTheDocument();
});

it('links through to the cash flow page', () => {
  renderCard();

  expect(screen.getByRole('link', { name: /details/i })).toHaveAttribute('href', '/finance/cash-flow');
});
