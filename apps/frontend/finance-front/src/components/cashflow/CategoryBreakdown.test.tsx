import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@mui/x-charts/BarChart', () => ({
  BarChart: ({ series }: { series: { label: string; data: number[] }[] }) => (
    <div data-testid="bar-chart">{series.map((s) => `${s.label}:${s.data.join(',')}`).join(' | ')}</div>
  )
}));
vi.mock('@mui/x-charts', () => ({
  PieChart: ({ series }: { series: { data: { label: string; value: number }[] }[] }) => (
    <div data-testid="pie-chart">{series[0].data.map((d) => `${d.label}:${d.value}`).join(' | ')}</div>
  )
}));

import CategoryBreakdown from './CategoryBreakdown';
import { Analytics } from '../../services/cashflowService';

const year = (y: number) => ({
  year: y, income: 0, expense: 0, consumption: 0, invested: 0, savings: 0, savingsRate: null,
  incomeChange: null, incomeChangePct: null, expenseChange: null, expenseChangePct: null
});

const analytics: Analytics = {
  years: [year(2024), year(2025)],
  investmentCategories: ['Investments', 'Savings'],
  months: [],
  categoryTrends: [
    { category: 'Groceries', byYear: { 2024: 3000, 2025: 4000 }, total: 7000, latest: 4000, previous: 3000, change: 1000, changePct: 33.3 },
    { category: 'Transport', byYear: { 2024: 1000, 2025: 800 }, total: 1800, latest: 800, previous: 1000, change: -200, changePct: -20 },
    { category: 'Investments', byYear: { 2025: 24000 }, total: 24000, latest: 24000, previous: 0, change: 24000, changePct: null }
  ],
  incomeSources: [],
  monthlyAverages: [],
  currency: 'EUR'
};

it('renders nothing without spending categories', () => {
  const { container } = render(
    <CategoryBreakdown analytics={{ ...analytics, categoryTrends: [] }} />
  );
  expect(container).toBeEmptyDOMElement();
});

it('keeps investing out of the spending charts', () => {
  render(<CategoryBreakdown analytics={analytics} />);

  expect(screen.getByTestId('pie-chart')).toHaveTextContent('Groceries:4000');
  expect(screen.getByTestId('pie-chart')).not.toHaveTextContent('Investments');
});

it('explains where the investing money went instead', () => {
  render(<CategoryBreakdown analytics={analytics} />);

  expect(screen.getByText(/24 000 € investments/i)).toBeInTheDocument();
  expect(screen.getByText(/bought an asset rather than being spent/i)).toBeInTheDocument();
});

it('omits the notice when nothing was invested', () => {
  render(
    <CategoryBreakdown
      analytics={{ ...analytics, categoryTrends: analytics.categoryTrends.slice(0, 2) }}
    />
  );

  expect(screen.queryByText(/bought an asset/i)).not.toBeInTheDocument();
});

it('shows each category share of the latest year', () => {
  render(<CategoryBreakdown analytics={analytics} />);

  // 4000 of 4800 spent
  expect(screen.getByText('83%')).toBeInTheDocument();
  expect(screen.getByText('17%')).toBeInTheDocument();
});

it('stacks every category by year in the history view', async () => {
  render(<CategoryBreakdown analytics={analytics} />);

  await userEvent.click(screen.getByRole('button', { name: 'Over time' }));

  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Groceries:3000,4000');
  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Transport:1000,800');
});

it('drills into one category from the picker', async () => {
  render(<CategoryBreakdown analytics={analytics} />);

  await userEvent.click(screen.getByLabelText('Category'));
  await userEvent.click(screen.getByRole('option', { name: 'Transport' }));

  expect(screen.getByText('Lifetime')).toBeInTheDocument();
  expect(screen.getByText('1800 €')).toBeInTheDocument();
  // Falling 200/year
  expect(screen.getByText('−200 € / year')).toBeInTheDocument();
});

it('drills in by clicking a category in the share list', async () => {
  render(<CategoryBreakdown analytics={analytics} />);

  await userEvent.click(screen.getByText('Groceries'));

  expect(screen.getByText('Lifetime')).toBeInTheDocument();
  expect(screen.getByText('7000 €')).toBeInTheDocument();
});

it('offers category chips before one is picked', () => {
  render(<CategoryBreakdown analytics={analytics} />);

  expect(screen.getByText('Transport · 1800 €')).toBeInTheDocument();
});
