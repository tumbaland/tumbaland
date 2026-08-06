import { render, screen } from '@testing-library/react';
import FinancialKPIs from './FinancialKPIs';
import { DashboardKPIs } from '../services/dashboardService';

const baseKpis: DashboardKPIs = {
  netWorth: 100000,
  assets: 100000,
  liabilities: 0,
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

it('shows a dash rather than a zero when there is no period to compare against', () => {
  render(<FinancialKPIs kpis={{ ...baseKpis, monthChange: null, monthChangePct: null }} />);

  expect(screen.getByText('—')).toBeInTheDocument();
  expect(screen.getByText(/no check-in to compare/)).toBeInTheDocument();
});

it('omits the percentage detail when only the percentage is unknown', () => {
  render(<FinancialKPIs kpis={{ ...baseKpis, monthChangePct: null }} />);

  expect(screen.getByText('+500 €')).toBeInTheDocument();
  expect(screen.queryByText('+0.5%')).not.toBeInTheDocument();
});

it('breaks net worth into assets and debt once a liability exists', () => {
  render(<FinancialKPIs kpis={{ ...baseKpis, netWorth: 60000, assets: 100000, liabilities: 40000 }} />);

  expect(screen.getByText(/100 000 € assets/)).toBeInTheDocument();
  expect(screen.getByText(/40 000 € debt/)).toBeInTheDocument();
});

it('formats amounts in the base currency it is given', () => {
  render(<FinancialKPIs kpis={baseKpis} currency="USD" />);

  expect(screen.getByText('+500 $')).toBeInTheDocument();
});
