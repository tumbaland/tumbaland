import { render, screen } from '@testing-library/react';
import EfficientFrontierChart from './EfficientFrontierChart';

const optimalPortfolio = { expectedReturn: 8, volatility: 12, sharpeRatio: 0.5 };
const assetStats = [
  { ticker: 'AAPL', expectedReturn: 10, volatility: 20, sharpeRatio: 0.4 },
  { ticker: 'BND', expectedReturn: 3, volatility: 5, sharpeRatio: 0.2 }
];

it('shows an empty state when there is no frontier data', () => {
  render(
    <EfficientFrontierChart frontierData={[]} optimalPortfolio={optimalPortfolio} assetStats={[]} riskFreeRate={2} />
  );
  expect(screen.getByText(/no efficient frontier data available/i)).toBeInTheDocument();
});

it('renders the chart, legend, and optimal-portfolio summary metrics with 2+ frontier points', () => {
  const frontierData = [
    { return: 3, risk: 5 },
    { return: 6, risk: 10 },
    { return: 9, risk: 18 }
  ];
  render(
    <EfficientFrontierChart
      frontierData={frontierData}
      optimalPortfolio={optimalPortfolio}
      assetStats={assetStats}
      riskFreeRate={2}
    />
  );

  expect(screen.getByText('Efficient Frontier Analysis')).toBeInTheDocument();
  expect(screen.getByText('Capital Allocation Line')).toBeInTheDocument();
  expect(screen.getByText('8.00%')).toBeInTheDocument(); // expected return
  expect(screen.getByText('12.00%')).toBeInTheDocument(); // volatility
  expect(screen.getByText('0.500')).toBeInTheDocument(); // sharpe ratio
  expect(screen.getByText('AAPL')).toBeInTheDocument();
  expect(screen.getByText('BND')).toBeInTheDocument();
});

it('draws a straight 2-point line when the frontier has exactly two points', () => {
  const frontierData = [
    { return: 3, risk: 5 },
    { return: 9, risk: 18 }
  ];
  const { container } = render(
    <EfficientFrontierChart
      frontierData={frontierData}
      optimalPortfolio={optimalPortfolio}
      assetStats={[]}
      riskFreeRate={2}
    />
  );

  const paths = container.querySelectorAll('path[stroke="#1976d2"]');
  expect(paths[0].getAttribute('d')).toMatch(/^M .+ L .+/);
});

it('handles a zero-volatility optimal portfolio without dividing by zero', () => {
  const frontierData = [{ return: 3, risk: 5 }, { return: 9, risk: 18 }];
  render(
    <EfficientFrontierChart
      frontierData={frontierData}
      optimalPortfolio={{ expectedReturn: 5, volatility: 0, sharpeRatio: 0 }}
      assetStats={[]}
      riskFreeRate={2}
    />
  );
  // slope falls back to 0 for zero volatility — component should still render, not throw/NaN out.
  expect(screen.getByText('Efficient Frontier Analysis')).toBeInTheDocument();
});
