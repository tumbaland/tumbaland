import { render, screen } from '@testing-library/react';
import NetWorthHero from './NetWorthHero';
import type { DashboardKPIs } from '../services/dashboardService';

const kpis = (over: Partial<DashboardKPIs> = {}): DashboardKPIs => ({
  netWorth: 522439,
  assets: 522439,
  liabilities: 0,
  asOf: '2026-11-01T00:00:00.000Z',
  monthChange: 5623,
  monthChangePct: 1.1,
  yearChange: 87844,
  yearChangePct: 20.2,
  totalGain: 127941,
  totalGainPct: 32.4,
  ...over
});

it('leads with the net worth and the month it is as of', () => {
  render(<NetWorthHero kpis={kpis()} />);

  expect(screen.getByText('Net worth · 2026-11')).toBeInTheDocument();
  expect(screen.getByText(/522.439/)).toBeInTheDocument();
});

it('shows the change over the month and the year, each with its percentage', () => {
  render(<NetWorthHero kpis={kpis()} />);

  expect(screen.getByText('Past month')).toBeInTheDocument();
  expect(screen.getByText('Past year')).toBeInTheDocument();
  expect(screen.getByText('+1.1%')).toBeInTheDocument();
  expect(screen.getByText('+20.2%')).toBeInTheDocument();
});

it('says there is nothing to compare, rather than showing a change of zero', () => {
  render(<NetWorthHero kpis={kpis({ monthChange: null, monthChangePct: null })} />);

  expect(screen.getByText('no check-in to compare')).toBeInTheDocument();
});

it('shows a fall as a fall', () => {
  render(<NetWorthHero kpis={kpis({ yearChange: -5000, yearChangePct: -1.2 })} />);

  expect(screen.getByText('-1.2%')).toBeInTheDocument();
});

it('shows what is owed only when something is', () => {
  const { rerender } = render(<NetWorthHero kpis={kpis()} />);
  expect(screen.queryByText(/debt/)).not.toBeInTheDocument();

  rerender(<NetWorthHero kpis={kpis({ assets: 600000, liabilities: 77561 })} />);
  expect(screen.getByText(/debt/)).toBeInTheDocument();
});
