import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import SafetyCard, { formatMonths } from './SafetyCard';
import type { DashboardData } from '../services/dashboardService';

type Safety = NonNullable<DashboardData['safety']>;

const safety = (over: Partial<Safety> = {}): Safety => ({
  cash: 9039,
  market: 261928,
  locked: 143908,
  unsorted: 4564,
  monthlySpending: 2300,
  cashMonths: 3.93,
  reachableMonths: 117.8,
  ...over
});

const renderCard = (value: Safety) =>
  render(
    <MemoryRouter>
      <SafetyCard safety={value} />
    </MemoryRouter>
  );

describe('formatMonths', () => {
  it('reads as months for a short time and as years for a long one', () => {
    expect(formatMonths(3.93)).toBe('3.9 months');
    expect(formatMonths(23.9)).toBe('23.9 months');
    expect(formatMonths(24)).toBe('2.0 years');
    expect(formatMonths(117.8)).toBe('9.8 years');
  });
});

it('says how long the cash would last, and against what spending', () => {
  renderCard(safety());

  expect(screen.getByText('3.9 months')).toBeInTheDocument();
  expect(screen.getByText(/of spending, at/)).toBeInTheDocument();
});

it('says how long it would last if what could be sold were sold too, before tax', () => {
  renderCard(safety());

  expect(screen.getByText('9.8 years')).toBeInTheDocument();
  expect(screen.getByText(/before\s+tax/)).toBeInTheDocument();
});

it('gives a goal to aim for and draws the progress toward it', () => {
  renderCard(safety());

  expect(screen.getByText(/Aim for 12 months in cash/)).toBeInTheDocument();
  expect(screen.getByRole('progressbar', { name: /toward 12 months/ })).toHaveAttribute('aria-valuenow', '32.75');
});

it('stops the progress at the goal once there is more cash than it asks for', () => {
  renderCard(safety({ cash: 60000, cashMonths: 26 }));

  expect(screen.getByRole('progressbar', { name: /toward 12 months/ })).toHaveAttribute('aria-valuenow', '100');
});

it('lists the money by how reachable it is, leaving out what there is none of', () => {
  renderCard(safety({ unsorted: 0 }));

  expect(screen.getByText('Cash')).toBeInTheDocument();
  expect(screen.getByText('Sellable')).toBeInTheDocument();
  expect(screen.getByText('Locked')).toBeInTheDocument();
  expect(screen.queryByText('Not sorted')).not.toBeInTheDocument();
});

it('asks for a bank statement when there is no spending to measure against', () => {
  renderCard(safety({ monthlySpending: null, cashMonths: null, reachableMonths: null }));

  expect(screen.getByText(/Import a bank statement/)).toBeInTheDocument();
  expect(screen.queryByText(/months$/)).not.toBeInTheDocument();
});

it('asks for the asset classes to be sorted when none have been', () => {
  renderCard(safety({ cash: 0, market: 0, locked: 0, unsorted: 523000, cashMonths: 0, reachableMonths: 0 }));

  expect(screen.getByText(/Mark each asset class as cash, sellable or locked/)).toBeInTheDocument();
  expect(screen.getByRole('link', { name: 'Net worth' })).toHaveAttribute('href', '/finance/net-worth');
});
