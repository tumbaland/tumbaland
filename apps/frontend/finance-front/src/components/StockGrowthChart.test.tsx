import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import StockGrowthChart from './StockGrowthChart';

const data = [
  { year: 1, moneyInvested: 1000, gainFromMarket: 50, portfolioTotalValue: 1050, inflationAdjustedValue: 1020 },
  { year: 2, moneyInvested: 2000, gainFromMarket: 150, portfolioTotalValue: 2150, inflationAdjustedValue: 2080 },
  { year: 3, moneyInvested: 3000, gainFromMarket: 350, portfolioTotalValue: 3350, inflationAdjustedValue: 3200 }
];

it('shows an empty state when there is no data', () => {
  render(<StockGrowthChart data={[]} />);
  expect(screen.getByText(/no data available/i)).toBeInTheDocument();
});

it('renders the chart legend and summary stats', () => {
  render(<StockGrowthChart data={data} />);

  expect(screen.getByText('Portfolio Total Value')).toBeInTheDocument();
  expect(screen.getByText('Money Invested')).toBeInTheDocument();
  expect(screen.getByText('Inflation Adjusted Value')).toBeInTheDocument();
  expect(screen.getByText('Showing 3 years of projection')).toBeInTheDocument();
  expect(screen.getByText(/Final portfolio value:/)).toBeInTheDocument();
});

it('toggles a line off and back on via its legend entry', async () => {
  render(<StockGrowthChart data={data} />);
  const legendEntry = screen.getByText('Money Invested');

  await userEvent.click(legendEntry);
  await userEvent.click(legendEntry);

  // Toggling doesn't throw and the legend entry remains rendered.
  expect(screen.getByText('Money Invested')).toBeInTheDocument();
});

it('renders a goal line when a goal is provided', () => {
  render(<StockGrowthChart data={data} goal={5000} />);
  expect(screen.getByText(/Goal:/)).toBeInTheDocument();
});

it('renders Monte Carlo bands when provided', () => {
  const mcBands = { years: [1, 2, 3], p10: [900, 1800, 2700], p50: [1050, 2150, 3350], p90: [1200, 2500, 4000] };
  const { container } = render(<StockGrowthChart data={data} mcBands={mcBands} />);

  // Bands render as extra <path> elements beyond the 3 per-line paths.
  expect(container.querySelectorAll('path').length).toBeGreaterThan(3);
});
