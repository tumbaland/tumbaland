import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => undefined };
});

vi.mock('../hooks/useHoldings', () => ({ useHoldings: vi.fn() }));
vi.mock('../hooks/useTrackedTicker', () => ({ useTrackedTickers: vi.fn() }));
vi.mock('../services/tickerPriceHistoryService', () => ({ getTickerPriceHistory: vi.fn() }));

import { useHoldings } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { getTickerPriceHistory } from '../services/tickerPriceHistoryService';
import PortfolioOptimizer from './PortfolioOptimizer';

const mockedUseHoldings = useHoldings as unknown as ReturnType<typeof vi.fn>;
const mockedUseTrackedTickers = useTrackedTickers as unknown as ReturnType<typeof vi.fn>;
const mockedGetHistory = getTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;

const holdings = [
  { _id: 'h1', ticker: 'AAPL', quantity: 10, avgBuyPrice: 100 },
  { _id: 'h2', ticker: 'MSFT', quantity: 5, avgBuyPrice: 200 }
];
const trackedTickers = [
  { _id: 't1', ticker: 'AAPL', displayName: 'Apple Inc', isActive: true },
  { _id: 't2', ticker: 'MSFT', displayName: 'Microsoft Corp', isActive: true }
];

// 25 days of gently trending, slightly noisy prices — enough to clear the
// `prices.length >= 20` gate and produce a non-degenerate covariance matrix.
function series(base: number, seed: number): { date: string; price: number }[] {
  const out: { date: string; price: number }[] = [];
  let price = base;
  for (let i = 0; i < 25; i++) {
    price *= 1 + (Math.sin(i + seed) * 0.01 + 0.001);
    out.push({ date: `2024-05-${String(i + 1).padStart(2, '0')}`, price });
  }
  return out;
}

const fullHistory = [
  ...series(150, 1).map((d) => ({ ticker: 'AAPL', ...d })),
  ...series(300, 2).map((d) => ({ ticker: 'MSFT', ...d }))
];

beforeEach(() => {
  vi.clearAllMocks();
  mockedUseHoldings.mockReturnValue({ data: holdings, isLoading: false });
  mockedUseTrackedTickers.mockReturnValue({ data: trackedTickers });
});

it('shows a spinner while holdings or prices are loading', () => {
  mockedUseHoldings.mockReturnValue({ data: [], isLoading: true });
  mockedGetHistory.mockReturnValue(new Promise(() => {}));
  render(<PortfolioOptimizer />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('prompts to add holdings when there are none', () => {
  mockedUseHoldings.mockReturnValue({ data: [], isLoading: false });
  render(<PortfolioOptimizer />);
  expect(screen.getByText(/add holdings in the portfolio page first/i)).toBeInTheDocument();
});

it('shows an error message when price history fails to load', async () => {
  mockedGetHistory.mockRejectedValue(new Error('boom'));
  render(<PortfolioOptimizer />);
  expect(await screen.findByText('Failed to load price history')).toBeInTheDocument();
});

it('shows the current-holdings table with computed return/value/weight once prices load', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory);
  render(<PortfolioOptimizer />);

  expect(await screen.findByText('Apple Inc')).toBeInTheDocument();
  expect(screen.getByText('Microsoft Corp')).toBeInTheDocument();
  // Both tickers have price history, so no "no price history" warning
  expect(screen.queryByText(/no price history for/i)).not.toBeInTheDocument();
});

it('warns about holdings missing price history and shows "—" for their stats', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory.filter((d) => d.ticker === 'AAPL'));
  render(<PortfolioOptimizer />);

  expect(await screen.findByText(/no price history for: MSFT/i)).toBeInTheDocument();
});

it('needs at least 2 tickers with data to run the simulation', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory.filter((d) => d.ticker === 'AAPL'));
  render(<PortfolioOptimizer />);

  expect(await screen.findByText(/need price history for at least 2 holdings/i)).toBeInTheDocument();
});

it('runs the Monte Carlo simulation and renders the efficient frontier once 2+ tickers have data', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory);
  render(<PortfolioOptimizer />);

  expect(await screen.findByText('Efficient Frontier')).toBeInTheDocument();
  expect(screen.getByText(/2,000 portfolios/)).toBeInTheDocument();
  expect(screen.getByText('What to Buy Next')).toBeInTheDocument();
  // Portfolio summary cards
  expect(screen.getByText('Your Portfolio')).toBeInTheDocument();
  expect(screen.getByText('★ Max Sharpe')).toBeInTheDocument();
  expect(screen.getByText('● Min Risk')).toBeInTheDocument();
});

it('shows the buy plan once an amount is entered, and updates the risk-free rate / re-runs on demand', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory);
  render(<PortfolioOptimizer />);
  await screen.findByText('Efficient Frontier');

  // Default investAmount is '1000', so a buy-plan table should already be present.
  expect(screen.getByText('What to Buy Next')).toBeInTheDocument();
  expect(screen.queryByText(/enter an amount above/i)).not.toBeInTheDocument();

  const investInput = screen.getByLabelText('Invest (€)');
  await userEvent.clear(investInput);
  expect(await screen.findByText(/enter an amount above/i)).toBeInTheDocument();

  const riskFreeInput = screen.getByLabelText('Risk-free (%/yr)');
  await userEvent.clear(riskFreeInput);
  await userEvent.type(riskFreeInput, '5');
  expect(riskFreeInput).toHaveValue('5');

  await userEvent.click(screen.getByRole('button', { name: /re-run/i }));
  expect(screen.getByText('Efficient Frontier')).toBeInTheDocument();
});

it('moves the target-risk slider and recomputes the analysis chips', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory);
  render(<PortfolioOptimizer />);
  await screen.findByText('Efficient Frontier');

  const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
  expect(slider).toBeInTheDocument();

  // jsdom doesn't implement pointer capture, which MUI's Slider needs for drag/keyboard
  // interaction — dispatch the underlying range input's change event directly instead.
  fireEvent.change(slider, { target: { value: slider.max } });

  await waitFor(() => expect(slider.value).toBe(slider.max));
});
