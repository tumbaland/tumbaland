import { render, screen } from '@testing-library/react';
import FinancialKPIs from './FinancialKPIs';
import { DashboardKPIs } from '../services/dashboardService';

const baseKpis: DashboardKPIs = {
  netWorth: 100000,
  asOf: '2024-05-01',
  monthChange: 500,
  monthChangePct: 0.5,
  yearChange: -200,
  yearChangePct: -0.2,
  totalGain: 0,
  totalGainPct: 0
};

it('renders the "as of" sublabel when asOf is set', () => {
  render(<FinancialKPIs kpis={baseKpis} />);
  expect(screen.getByText(/as of 2024-05/)).toBeInTheDocument();
});

it('omits the sublabel when asOf is null', () => {
  render(<FinancialKPIs kpis={{ ...baseKpis, asOf: null }} />);
  expect(screen.queryByText(/as of/)).not.toBeInTheDocument();
});

it('shows an up-trend for a positive change and a down-trend for a negative one', () => {
  render(<FinancialKPIs kpis={baseKpis} />);
  expect(screen.getByText('+500 €')).toBeInTheDocument();
  // Intl.NumberFormat renders the negative sign as U+2212 (minus sign), not ASCII hyphen.
  expect(screen.getByText('−200 €')).toBeInTheDocument();
});

it('shows a flat trend for a zero change', () => {
  render(<FinancialKPIs kpis={baseKpis} />);
  // totalGain is 0 → signed() prefixes '+', trendColor/trendIcon both hit the "flat" branch
  expect(screen.getByText('+0 €')).toBeInTheDocument();
});
