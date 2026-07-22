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
import PortfolioPlanner from './PortfolioPlanner';

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

// The projection debounces its (heavy) Monte Carlo recompute by 250ms, so
// results always appear asynchronously — allow generous find timeouts.
const FIND = { timeout: 4000 };

function getNumberInput(label: string) {
  return screen.getByLabelText(label) as HTMLInputElement;
}

async function setNumber(label: string, value: string) {
  const input = getNumberInput(label);
  await userEvent.clear(input);
  if (value !== '') await userEvent.type(input, value);
  return input;
}

// These MUI Selects don't wire aria-labelledby back to the floating InputLabel, so
// getByLabelText can't find them — locate the <label> by its exact text instead, then
// open the combobox inside that label's FormControl.
async function selectOption(labelText: string, optionName: string | RegExp) {
  const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === labelText);
  if (!label) throw new Error(`no label found for ${labelText}`);
  const formControl = label.closest('.MuiFormControl-root') as HTMLElement;
  const combobox = formControl.querySelector('[role="combobox"]') as HTMLElement;
  await userEvent.click(combobox);
  await userEvent.click(await screen.findByRole('option', { name: optionName }));
}

function hasFormLabel(labelText: string): boolean {
  return Array.from(document.querySelectorAll('label')).some((l) => l.textContent === labelText);
}

// Frontier/Projection inputs are persisted to localStorage, and their panel is
// hidden until its tab is selected — switch there before interacting with it.
async function switchTab(name: string) {
  await userEvent.click(screen.getByRole('tab', { name }));
}

beforeEach(() => {
  vi.clearAllMocks();
  localStorage.clear();
  mockedUseHoldings.mockReturnValue({ data: holdings, isLoading: false });
  mockedUseTrackedTickers.mockReturnValue({ data: trackedTickers });
  mockedGetHistory.mockResolvedValue(fullHistory);
});

it('shows a spinner while holdings or prices are loading', () => {
  mockedUseHoldings.mockReturnValue({ data: [], isLoading: true });
  mockedGetHistory.mockReturnValue(new Promise(() => {}));
  render(<PortfolioPlanner />);
  expect(screen.getByRole('progressbar')).toBeInTheDocument();
});

it('shows an error message when price history fails to load', async () => {
  mockedGetHistory.mockRejectedValue(new Error('boom'));
  render(<PortfolioPlanner />);
  expect(await screen.findByText('Failed to load price history')).toBeInTheDocument();
});

it('falls back to a manual-assumptions projection when there are no holdings', async () => {
  mockedUseHoldings.mockReturnValue({ data: [], isLoading: false });
  render(<PortfolioPlanner />);

  expect(screen.getByText(/add holdings in the investments page/i)).toBeInTheDocument();
  // No frontier without holdings, but the projection still runs on presets
  expect(screen.queryByText('Efficient Frontier')).not.toBeInTheDocument();
  expect(hasFormLabel('Scenario Preset')).toBe(true);
  expect(await screen.findByText('Detailed Yearly Breakdown', undefined, FIND)).toBeInTheDocument();
  expect(screen.getByText('Showing 30 years of projection')).toBeInTheDocument();
});

it('renders holdings, the efficient frontier and a history-derived projection once prices load', async () => {
  render(<PortfolioPlanner />);

  expect(await screen.findByText('Apple Inc')).toBeInTheDocument();
  expect(screen.getByText('Microsoft Corp')).toBeInTheDocument();
  expect(screen.queryByText(/no price history for/i)).not.toBeInTheDocument();

  expect(await screen.findByText('Efficient Frontier')).toBeInTheDocument();
  expect(screen.getByText(/2,000 portfolios/)).toBeInTheDocument();
  expect(screen.getByText('What to Buy Next')).toBeInTheDocument();
  expect(screen.getByText('Your Portfolio')).toBeInTheDocument();
  expect(screen.getByText('★ Max Sharpe')).toBeInTheDocument();
  expect(screen.getByText('● Min Risk')).toBeInTheDocument();

  // Projection basis defaults to the current portfolio, with derived, shrunk assumptions
  expect(hasFormLabel('Projection Basis')).toBe(true);
  const basisLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Projection Basis')!;
  const basisCombobox = basisLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  expect(basisCombobox).toHaveTextContent('Current portfolio');
  expect(screen.getByText(/derived from your holdings/i)).toBeInTheDocument();
  expect(screen.getByText(/shrunk toward a long-run/i)).toBeInTheDocument();
  expect(hasFormLabel('Scenario Preset')).toBe(false);
  expect(await screen.findByText('Detailed Yearly Breakdown', undefined, FIND)).toBeInTheDocument();
});

it('defaults the starting capital to the real portfolio value', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');

  const capital = getNumberInput('Starting Capital (EUR)');
  await waitFor(() => expect(parseFloat(capital.value)).toBeGreaterThan(1000));
  expect(screen.getByText('Defaults to your portfolio value')).toBeInTheDocument();
});

it('warns about holdings missing price history and skips the frontier below 2 tickers', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory.filter((d) => d.ticker === 'AAPL'));
  render(<PortfolioPlanner />);

  expect(await screen.findByText(/no price history for: MSFT/i)).toBeInTheDocument();
  expect(await screen.findByText(/need price history for at least 2 holdings/i)).toBeInTheDocument();
  // Manual projection still available
  expect(hasFormLabel('Scenario Preset')).toBe(true);
});

it('switches the projection basis to manual, applies presets, and flips to custom on edit', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');
  await setNumber('Investment Period (Years)', '3'); // keep Monte Carlo runs cheap

  await selectOption('Projection Basis', 'Manual');
  expect(hasFormLabel('Scenario Preset')).toBe(true);

  await selectOption('Scenario Preset', 'Aggressive');
  expect(getNumberInput('Growth (%)').value).toBe('12');
  expect(getNumberInput('Volatility (%)').value).toBe('25');

  await setNumber('Growth (%)', '9');
  const presetLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Scenario Preset')!;
  const combobox = presetLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  expect(combobox).toHaveTextContent('Custom');
});

it('recalculates when the investment period changes', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');

  await setNumber('Investment Period (Years)', '5');
  expect(await screen.findByText('Showing 5 years of projection', undefined, FIND)).toBeInTheDocument();
});

it('shows years-to-goal when a reachable target goal is set', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');
  await setNumber('Investment Period (Years)', '5');
  await setNumber('Target Goal (EUR)', '5000');

  expect(await screen.findByText('Years to Goal', undefined, FIND)).toBeInTheDocument();
  expect(await screen.findByText(/^\d+ years$/, undefined, FIND)).toBeInTheDocument();
});

it('shows "Not reached" when the goal is out of reach', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');
  await setNumber('Investment Period (Years)', '3');
  await setNumber('Target Goal (EUR)', '999999999');

  expect(await screen.findByText('Not reached', undefined, FIND)).toBeInTheDocument();
});

it('shows the buy plan by default and asks for an amount when cleared', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Frontier');

  expect(screen.queryByText(/enter an amount above/i)).not.toBeInTheDocument();

  const investInput = screen.getByLabelText('Invest (€)');
  await userEvent.clear(investInput);
  expect(await screen.findByText(/enter an amount above/i)).toBeInTheDocument();
});

it('updates the risk-free rate and re-runs the simulation on demand', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Frontier');

  const riskFreeInput = screen.getByLabelText('Risk-free (%/yr)');
  await userEvent.clear(riskFreeInput);
  await userEvent.type(riskFreeInput, '5');
  expect(riskFreeInput).toHaveValue('5');

  await userEvent.click(screen.getByRole('button', { name: /re-run/i }));
  expect(screen.getByText('Efficient Frontier')).toBeInTheDocument();
});

it('moves the target-risk slider', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Frontier');

  const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
  expect(slider).toBeInTheDocument();

  // jsdom doesn't implement pointer capture, which MUI's Slider needs for drag/keyboard
  // interaction — dispatch the underlying range input's change event directly instead.
  fireEvent.change(slider, { target: { value: slider.max } });

  await waitFor(() => expect(slider.value).toBe(slider.max));
});

it('reveals inflation and fee fields under advanced assumptions', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');

  await userEvent.click(screen.getByText('Advanced assumptions'));
  expect(screen.getByLabelText('Inflation (%)')).toBeInTheDocument();
  expect(screen.getByLabelText('Annual Fee (%)')).toBeInTheDocument();
});

it('downloads a CSV of the projection', async () => {
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  vi.stubGlobal('URL', { ...URL, createObjectURL, revokeObjectURL });
  const clickSpy = vi.spyOn(HTMLAnchorElement.prototype, 'click').mockImplementation(() => {});

  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');
  await userEvent.click(await screen.findByRole('button', { name: /download csv/i }, FIND));

  expect(createObjectURL).toHaveBeenCalled();
  expect(clickSpy).toHaveBeenCalled();
  expect(revokeObjectURL).toHaveBeenCalledWith('blob:mock');

  clickSpy.mockRestore();
  vi.unstubAllGlobals();
});
