import { render, screen } from '@testing-library/react';
import CashflowSummaryCards from './CashflowSummaryCards';
import { CashflowSummary } from '../../services/cashflowService';

const base: CashflowSummary = {
  months: [{ month: '2026-07', income: 4000, expense: 2500, savings: 1500, savingsRate: 37.5 }],
  categories: [
    { category: 'Rent', spent: 900, budget: 800, variance: 100 },
    { category: 'Groceries', spent: 300, budget: null, variance: null }
  ],
  totals: { month: 'all', income: 4000, expense: 2500, savings: 1500, savingsRate: 37.5 },
  growth: {
    from: '2026-07',
    to: '2026-08',
    netWorthChange: 2000,
    contributions: 1500,
    marketGrowth: 500,
    complete: true
  }
};

it('shows income, expenses, savings and rate', () => {
  render(<CashflowSummaryCards summary={base} />);

  expect(screen.getByText('4000 €')).toBeInTheDocument();
  expect(screen.getByText('2500 €')).toBeInTheDocument();
  expect(screen.getAllByText('1500 €').length).toBeGreaterThan(0);
  expect(screen.getByText('+37.5%')).toBeInTheDocument();
});

it('shows a dash for a savings rate with no income behind it', () => {
  render(
    <CashflowSummaryCards
      summary={{ ...base, totals: { ...base.totals, income: 0, savingsRate: null } }}
    />
  );

  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.getByText('no income recorded')).toBeInTheDocument();
});

it('explains the net-worth move as contributions versus market', () => {
  render(<CashflowSummaryCards summary={base} />);

  expect(screen.getByText(/Why net worth moved · 2026-07 → 2026-08/)).toBeInTheDocument();
  expect(screen.getByText('You contributed')).toBeInTheDocument();
  expect(screen.getByText('+500 €')).toBeInTheDocument();
});

it('flags an incomplete split', () => {
  render(<CashflowSummaryCards summary={{ ...base, growth: { ...base.growth!, complete: false } }} />);

  expect(screen.getByText(/No transactions recorded for 2026-07/)).toBeInTheDocument();
});

it('omits the growth section when there is nothing to compare', () => {
  render(<CashflowSummaryCards summary={{ ...base, growth: null }} />);

  expect(screen.queryByText('You contributed')).not.toBeInTheDocument();
});

it('lists categories with their budget comparison', () => {
  render(<CashflowSummaryCards summary={base} />);

  expect(screen.getByText('Rent')).toBeInTheDocument();
  expect(screen.getByText('900 €')).toBeInTheDocument();
  expect(screen.getByText('/ 800 €')).toBeInTheDocument();
});

it('counts how many categories are over budget', () => {
  render(<CashflowSummaryCards summary={base} />);

  expect(screen.getByText(/1 over budget/)).toBeInTheDocument();
});

it('does not count an unbudgeted category as over budget', () => {
  render(
    <CashflowSummaryCards
      summary={{ ...base, categories: [{ category: 'Groceries', spent: 900, budget: null, variance: null }] }}
    />
  );

  expect(screen.queryByText(/over budget/)).not.toBeInTheDocument();
});

it('omits the category section when nothing has been categorised', () => {
  render(<CashflowSummaryCards summary={{ ...base, categories: [] }} />);

  expect(screen.queryByText('Spending by category')).not.toBeInTheDocument();
});

it('formats amounts in the given currency', () => {
  render(<CashflowSummaryCards summary={base} currency="USD" />);

  expect(screen.getByText('4000 $')).toBeInTheDocument();
});
