import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// The charts render an SVG that jsdom cannot measure; these stubs keep the
// assertions on the numbers and labels rather than on chart internals.
vi.mock('@mui/x-charts/BarChart', () => ({
  BarChart: ({ series }: { series: { label: string; data: number[] }[] }) => (
    <div data-testid="bar-chart">{series.map((s) => `${s.label}:${s.data.join(',')}`).join(' | ')}</div>
  )
}));
vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series }: { series: { label: string; data: number[] }[] }) => (
    <div data-testid="line-chart">{series.map((s) => `${s.label}:${s.data.join(',')}`).join(' | ')}</div>
  )
}));

import CashflowAnalytics from './CashflowAnalytics';
import { Analytics } from '../../services/cashflowService';

const year = (y: number, income: number, expense: number, over: Record<string, unknown> = {}) => ({
  year: y, income, expense, savings: income - expense,
  savingsRate: income > 0 ? ((income - expense) / income) * 100 : null,
  incomeChange: null, incomeChangePct: null, expenseChange: null, expenseChangePct: null,
  ...over
});

const analytics: Analytics = {
  years: [
    year(2024, 40000, 20000),
    year(2025, 50000, 15000, { incomeChange: 10000, incomeChangePct: 25, expenseChange: -5000, expenseChangePct: -25 })
  ],
  months: [
    { period: '2025-01', income: 4000, expense: 1200, savings: 2800 },
    { period: '2025-02', income: 4000, expense: 1400, savings: 2600 }
  ],
  categoryTrends: [
    { category: 'Groceries', byYear: { 2024: 1000, 2025: 1500 }, total: 2500, latest: 1500, previous: 1000, change: 500, changePct: 50 },
    { category: 'Travel', byYear: { 2024: 800, 2025: 200 }, total: 1000, latest: 200, previous: 800, change: -600, changePct: -75 }
  ],
  incomeSources: [],
  monthlyAverages: [],
  currency: 'EUR'
};

it('renders nothing when there is no series', () => {
  const { container } = render(
    <CashflowAnalytics analytics={{ ...analytics, years: [], months: [] }} />
  );
  expect(container).toBeEmptyDOMElement();
});

it('starts on monthly and charts the month series', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Income:4000,4000');
  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Spending:1200,1400');
});

it('switches to the yearly series', async () => {
  render(<CashflowAnalytics analytics={analytics} />);

  await userEvent.click(screen.getByRole('button', { name: 'Yearly' }));

  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Income:40000,50000');
  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Spending:20000,15000');
});

it('draws a trailing average line alongside the bars', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  // 1200 then (1200+1400)/2
  expect(screen.getByTestId('line-chart')).toHaveTextContent('Spending average:1200,1300');
});

it('reports the spending trend per period', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText('Spending trend')).toBeInTheDocument();
  // Rising 200/month across the two months
  expect(screen.getByText(/\+200 € \/ month/)).toBeInTheDocument();
});

it('relabels the trend unit when switched to yearly', async () => {
  render(<CashflowAnalytics analytics={analytics} />);

  await userEvent.click(screen.getByRole('button', { name: 'Yearly' }));

  // Both the spending and income cards carry the unit
  expect(screen.getAllByText(/\/ year/).length).toBe(2);
});

it('shows the year-on-year table newest first', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  const rows = screen.getAllByRole('row').map((r) => r.textContent);
  const dataRows = rows.filter((r) => r?.match(/202\d/));
  expect(dataRows[0]).toContain('2025');
  expect(dataRows[1]).toContain('2024');
});

it('shows year-on-year percentage changes', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText('+25.0%')).toBeInTheDocument();
  expect(screen.getByText('-25.0%')).toBeInTheDocument();
});

it('dashes the comparison for the earliest year', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

it('ranks the biggest movers by absolute change, not by total', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText('Biggest movers in spending')).toBeInTheDocument();
  // Travel moved 600 against Groceries' 500, so it leads despite a smaller total
  const movers = screen.getAllByText(/^(Groceries|Travel)$/).map((el) => el.textContent);
  expect(movers[0]).toBe('Travel');
});
