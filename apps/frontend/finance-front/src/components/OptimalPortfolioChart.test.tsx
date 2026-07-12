import { render, screen } from '@testing-library/react';
import OptimalPortfolioChart from './OptimalPortfolioChart';

it('shows an empty state when there are no asset stats', () => {
  render(<OptimalPortfolioChart assetStats={[]} correlationMatrix={[]} selectedTickers={[]} />);
  expect(screen.getByText(/no analysis data available/i)).toBeInTheDocument();
});

it('renders the scatter plot and stats table, covering the risk/return/performance color branches', () => {
  const assetStats = [
    { ticker: 'EXCEL', expectedReturn: 20, volatility: 10, sharpeRatio: 1.5 }, // excellent, low risk, high return
    { ticker: 'GOOD', expectedReturn: 10, volatility: 20, sharpeRatio: 0.7 }, // good, medium risk, medium return
    { ticker: 'POOR', expectedReturn: 2, volatility: 30, sharpeRatio: 0.1 } // poor, high risk, low return
  ];

  render(<OptimalPortfolioChart assetStats={assetStats} correlationMatrix={[]} selectedTickers={[]} />);

  expect(screen.getByText('Risk vs Return Analysis')).toBeInTheDocument();
  expect(screen.getByText('Asset Statistics')).toBeInTheDocument();
  expect(screen.getAllByText('EXCEL').length).toBeGreaterThan(0);
  expect(screen.getByText('Excellent')).toBeInTheDocument();
  expect(screen.getByText('Good')).toBeInTheDocument();
  expect(screen.getByText('Poor')).toBeInTheDocument();
  expect(screen.getByText('Low')).toBeInTheDocument();
  expect(screen.getByText('Medium')).toBeInTheDocument();
  expect(screen.getByText('High')).toBeInTheDocument();
  // No correlation matrix section when empty
  expect(screen.queryByText('Asset Correlation Matrix')).not.toBeInTheDocument();
});

it('renders the correlation matrix with all correlation-strength color bands', () => {
  const assetStats = [{ ticker: 'A', expectedReturn: 5, volatility: 10, sharpeRatio: 0.4 }];
  const selectedTickers = ['A', 'B', 'C', 'D', 'E'];
  const correlationMatrix = [
    [1, 0.8, 0.5, 0, -0.5],
    [0.8, 1, 0.5, 0, -0.5],
    [0.5, 0.5, 1, 0, -0.5],
    [0, 0, 0, 1, -0.5],
    [-0.5, -0.5, -0.5, -0.5, 1]
  ];

  render(<OptimalPortfolioChart assetStats={assetStats} correlationMatrix={correlationMatrix} selectedTickers={selectedTickers} />);

  expect(screen.getByText('Asset Correlation Matrix')).toBeInTheDocument();
  expect(screen.getAllByText('0.80').length).toBeGreaterThan(0);
  expect(screen.getAllByText('-0.50').length).toBeGreaterThan(0);
  expect(screen.getByText('Strong Negative')).toBeInTheDocument();
  expect(screen.getByText('Strong Positive')).toBeInTheDocument();
});

it('defaults a missing correlation matrix cell to 0', () => {
  const assetStats = [{ ticker: 'A', expectedReturn: 5, volatility: 10, sharpeRatio: 0.4 }];
  render(
    <OptimalPortfolioChart assetStats={assetStats} correlationMatrix={[[]]} selectedTickers={['A', 'B']} />
  );

  // correlationMatrix[0][1] is undefined -> falls back to 0
  expect(screen.getAllByText('0.00').length).toBeGreaterThan(0);
});
