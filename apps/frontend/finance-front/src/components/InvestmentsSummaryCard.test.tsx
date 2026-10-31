import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import InvestmentsSummaryCard from './InvestmentsSummaryCard';
import type { DashboardData } from '../services/dashboardService';

type Holdings = NonNullable<DashboardData['holdings']>;

const holdings = (over: Partial<Holdings> = {}): Holdings => ({
  count: 6,
  totalValue: 257004,
  totalCost: 166669,
  gain: 90335,
  gainPct: 54.2,
  dividends: 2394.07,
  realizedGain: 2146.17,
  unconverted: 0,
  ...over
});

const renderCard = (value: Holdings) =>
  render(
    <MemoryRouter>
      <InvestmentsSummaryCard holdings={value} />
    </MemoryRouter>
  );

it('counts the holdings, singular and plural', () => {
  const { rerender } = renderCard(holdings({ count: 1 }));
  expect(screen.getByText('Investments · 1 holding')).toBeInTheDocument();

  rerender(
    <MemoryRouter>
      <InvestmentsSummaryCard holdings={holdings({ count: 6 })} />
    </MemoryRouter>
  );
  expect(screen.getByText('Investments · 6 holdings')).toBeInTheDocument();
});

it('shows what investing has paid and realised, not only what prices did', () => {
  renderCard(holdings());

  expect(screen.getByText('Dividends received')).toBeInTheDocument();
  expect(screen.getByText('2394,07 €')).toBeInTheDocument();
  expect(screen.getByText(/all time, incl. sold funds/)).toBeInTheDocument();
  expect(screen.getByText('Realized gains')).toBeInTheDocument();
  expect(screen.getByText('+2146 €')).toBeInTheDocument();
});

it('shows a dash for dividends and gains when there are none', () => {
  renderCard(holdings({ dividends: 0, realizedGain: 0 }));

  expect(screen.getAllByText('—')).toHaveLength(2);
});

it('shows a realised loss as a loss', () => {
  renderCard(holdings({ realizedGain: -300 }));

  expect(screen.getByText(/^[-−]300 €$/)).toBeInTheDocument();
});

it('still renders against a service that does not send the new figures', () => {
  const { dividends, realizedGain, ...older } = holdings();
  void dividends;
  void realizedGain;
  renderCard(older as Holdings);

  expect(screen.getAllByText('—')).toHaveLength(2);
});

it('links through to the holdings', () => {
  renderCard(holdings());

  expect(screen.getByRole('link', { name: /view holdings/i })).toHaveAttribute('href', '/finance/investments');
});

it('warns about holdings that could not be converted', () => {
  renderCard(holdings({ unconverted: 2 }));

  expect(screen.getByText(/2 holdings are quoted in a currency with no exchange rate/)).toBeInTheDocument();
});
