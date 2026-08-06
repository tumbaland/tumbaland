import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import CashflowCard from './CashflowCard';
import { DashboardData } from '../services/dashboardService';

type Cashflow = NonNullable<DashboardData['cashflow']>;

const base: Cashflow = {
  latestMonth: { month: '2026-07', income: 4000, expense: 2500, savings: 1500, savingsRate: 37.5 },
  averageSavingsRate: 32,
  growth: {
    from: '2026-07',
    to: '2026-08',
    netWorthChange: 2000,
    contributions: 1500,
    marketGrowth: 500,
    complete: true
  }
};

const renderCard = (cashflow: Cashflow = base, currency?: string) =>
  render(
    <MemoryRouter>
      <CashflowCard cashflow={cashflow} currency={currency} />
    </MemoryRouter>
  );

it('shows the latest month savings and rate', () => {
  renderCard();

  expect(screen.getByText(/Saved · 2026-07/)).toBeInTheDocument();
  expect(screen.getAllByText('1500 €').length).toBeGreaterThan(0);
  expect(screen.getByText('+37.5%')).toBeInTheDocument();
});

it('shows the twelve-month average rate when there is one', () => {
  renderCard();

  expect(screen.getByText('12-month average')).toBeInTheDocument();
  expect(screen.getByText('+32.0%')).toBeInTheDocument();
});

it('omits the average when it cannot be computed', () => {
  renderCard({ ...base, averageSavingsRate: null });

  expect(screen.queryByText('12-month average')).not.toBeInTheDocument();
});

it('shows a dash for a month with no income to save from', () => {
  renderCard({
    ...base,
    latestMonth: { month: '2026-07', income: 0, expense: 400, savings: -400, savingsRate: null }
  });

  expect(screen.getByText('—')).toBeInTheDocument();
});

it('splits the net-worth change into contributions and market movement', () => {
  renderCard();

  expect(screen.getByText(/Net worth moved 2000 €/)).toBeInTheDocument();
  expect(screen.getByText('You contributed')).toBeInTheDocument();
  // The month's savings and the contribution figure are the same amount here
  expect(screen.getAllByText('1500 €')).toHaveLength(2);
  expect(screen.getByText('+500 €')).toBeInTheDocument();
});

it('warns when the period has no transactions to attribute the change to', () => {
  renderCard({ ...base, growth: { ...base.growth!, complete: false } });

  expect(screen.getByText(/No transactions for 2026-07/)).toBeInTheDocument();
});

it('does not warn when the period is fully covered', () => {
  renderCard();

  expect(screen.queryByText(/No transactions for/)).not.toBeInTheDocument();
});

it('renders without a growth breakdown', () => {
  renderCard({ ...base, growth: null });

  expect(screen.queryByText('You contributed')).not.toBeInTheDocument();
  expect(screen.getByText('Cash Flow')).toBeInTheDocument();
});

it('renders without a latest month', () => {
  renderCard({ ...base, latestMonth: null });

  expect(screen.queryByText('Savings rate')).not.toBeInTheDocument();
});

it('formats amounts in the given currency', () => {
  renderCard(base, 'USD');

  expect(screen.getAllByText('1500 $').length).toBeGreaterThan(0);
});

it('links through to the cash flow page', () => {
  renderCard();

  expect(screen.getByRole('link', { name: /open cash flow/i })).toHaveAttribute('href', '/cash-flow');
});
