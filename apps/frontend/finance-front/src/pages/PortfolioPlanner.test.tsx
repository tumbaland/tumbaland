import { render, screen, waitFor, fireEvent } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

/**
 * This page runs a 2,000-iteration Monte Carlo on every render, and most tests
 * here wait on the frontier it produces. CI runs the suite under v8 coverage
 * instrumentation on a shared two-core runner, where this file reported 242s
 * wall against ~15s locally — enough for vitest's 5s default to expire on the
 * simulation rather than on any real failure.
 *
 * Scoped to this file rather than raised globally: everything else in the suite
 * should still fail fast, and 20s is generous for the simulation while still
 * catching a genuine hang.
 */
vi.setConfig({ testTimeout: 20_000, hookTimeout: 20_000 });

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => undefined };
});

vi.mock('../hooks/useHoldings', () => ({ useHoldings: vi.fn() }));
vi.mock('../hooks/useTrackedTicker', () => ({ useTrackedTickers: vi.fn() }));
vi.mock('../services/tickerPriceHistoryService', () => ({ getTickerPriceHistory: vi.fn() }));

// The page reads its own retention window to decide whether a short history is
// a paywall or just young data. Stubbed at the query, so no QueryClientProvider
// is needed; the other two hooks on this page are mocked outright.
vi.mock('@tanstack/react-query', () => ({ useQuery: vi.fn() }));
vi.mock('../services/entitlementsService', () => ({ getMyEntitlements: vi.fn() }));

import { useQuery } from '@tanstack/react-query';
import { useHoldings } from '../hooks/useHoldings';
import { useTrackedTickers } from '../hooks/useTrackedTicker';
import { getTickerPriceHistory } from '../services/tickerPriceHistoryService';
import PortfolioPlanner from './PortfolioPlanner';

const mockedUseHoldings = useHoldings as unknown as ReturnType<typeof vi.fn>;
const mockedUseTrackedTickers = useTrackedTickers as unknown as ReturnType<typeof vi.fn>;
const mockedGetHistory = getTickerPriceHistory as unknown as ReturnType<typeof vi.fn>;
const mockedUseQuery = useQuery as unknown as ReturnType<typeof vi.fn>;

/** What `GET /me/entitlements` resolves to for these tests. */
const onPlan = (retentionDays: number) => ({ data: { limits: { retentionDays } } });

const holdings = [
  { _id: 'h1', ticker: 'AAPL', quantity: 10, avgBuyPrice: 100 },
  { _id: 'h2', ticker: 'MSFT', quantity: 5, avgBuyPrice: 200 }
];
const trackedTickers = [
  { _id: 't1', ticker: 'AAPL', displayName: 'Apple Inc', isActive: true },
  { _id: 't2', ticker: 'MSFT', displayName: 'Microsoft Corp', isActive: true }
];

// Gently trending, slightly noisy prices, one close per weekday — the shape the
// daily job actually produces. Consecutive days matter to the simulation now:
// it drops any "return" taken across a gap longer than a long weekend, so a
// sparse fixture would be discarded rather than merely coarse.
//
// Two independent gates then have to clear: enough observations for a
// non-degenerate covariance matrix, and an overlap of at least
// MIN_ALIGNED_DAYS. Retention clips by *date*, so the span is what detects a
// plan-truncated range.
function series(base: number, seed: number, spanDays = 800): { date: string; price: number }[] {
  const out: { date: string; price: number }[] = [];
  const day = new Date('2024-01-01T00:00:00.000Z');
  const end = day.getTime() + spanDays * 86_400_000;
  let price = base;
  let i = 0;
  while (day.getTime() <= end) {
    if (![0, 6].includes(day.getUTCDay())) {
      price *= 1 + (Math.sin(i + seed) * 0.01 + 0.001);
      out.push({ date: day.toISOString().slice(0, 10), price });
      i++;
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
}

/** The same shape, but clipped to a free plan's 90-day retention window. */
function truncatedSeries(base: number, seed: number) {
  return series(base, seed, 90);
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
  // Both series are requested; unless a test says otherwise the weekly one is
  // empty, so the daily basis is chosen exactly as before.
  mockedGetHistory.mockImplementation(({ interval }: { interval?: string } = {}) =>
    Promise.resolve(interval === 'weekly' ? [] : fullHistory)
  );
  // Unlimited retention by default: nothing these tests do is a paywall unless
  // they say so.
  mockedUseQuery.mockReturnValue(onPlan(-1));
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
  // No frontier without holdings, but the projection still runs on manual fields
  expect(screen.queryByText('Efficient Frontier')).not.toBeInTheDocument();
  expect(hasFormLabel('Growth (%)')).toBe(true);
  expect(hasFormLabel('Volatility (%)')).toBe(true);
  expect(await screen.findByText('Detailed Yearly Breakdown', undefined, FIND)).toBeInTheDocument();
  expect(screen.getByText('Showing 30 years of projection')).toBeInTheDocument();
});

it('renders holdings, the efficient frontier and a history-derived projection once prices load', async () => {
  render(<PortfolioPlanner />);

  // `getAllByText`: the holdings table names each instrument, and so does the
  // calculation breakdown that explains where the frontier's numbers came from.
  expect(await screen.findAllByText('Apple Inc')).not.toHaveLength(0);
  expect(screen.getAllByText('Microsoft Corp')).not.toHaveLength(0);
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
  expect(hasFormLabel('Growth (%)')).toBe(false);
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
  expect(hasFormLabel('Growth (%)')).toBe(true);
});

it('switches the projection basis and updates the derived assumptions', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');
  await setNumber('Investment Period (Years)', '3'); // keep Monte Carlo runs cheap

  const basisLabel = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Projection Basis')!;
  const basisCombobox = basisLabel.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  expect(basisCombobox).toHaveTextContent('Current portfolio');

  await selectOption('Projection Basis', 'Min Risk');
  expect(basisCombobox).toHaveTextContent('Min Risk');
  // No manual growth/volatility fields once a frontier-derived basis is active
  expect(hasFormLabel('Growth (%)')).toBe(false);
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

it('shows the inflation field directly, with no fee field or hidden section', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Projection');

  expect(screen.getByLabelText('Inflation (%)')).toBeInTheDocument();
  expect(screen.queryByText('Advanced assumptions')).not.toBeInTheDocument();
  expect(screen.queryByLabelText('Annual Fee (%)')).not.toBeInTheDocument();
});

it('downloads a CSV of the projection', async () => {
  const createObjectURL = vi.fn().mockReturnValue('blob:mock');
  const revokeObjectURL = vi.fn();
  const realURL = URL;
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
  // Restore only what this test stubbed. `vi.unstubAllGlobals()` would also
  // drop the `localStorage` stub that `test/setup.ts` installs once at module
  // load, silently breaking every test declared after this one.
  vi.stubGlobal('URL', realURL);
});

describe('retention-truncated price history', () => {
  const truncated = [
    ...truncatedSeries(150, 1).map((d) => ({ ticker: 'AAPL', ...d })),
    ...truncatedSeries(300, 2).map((d) => ({ ticker: 'MSFT', ...d }))
  ];

  it('refuses to draw a frontier from a 90-day window and says why', async () => {
    mockedUseQuery.mockReturnValue(onPlan(90));
    mockedGetHistory.mockResolvedValue(truncated);
    render(<PortfolioPlanner />);
    // Tabs only exist once loading finishes.
    await screen.findByText('Apple Inc');
    await switchTab('Frontier');

    // A covariance estimate off ninety closes is not a rougher answer, it is a
    // confidently wrong one — so the chart is withheld rather than degraded.
    expect(await screen.findByText(/Not enough overlapping price history/i, {}, FIND)).toBeInTheDocument();
    expect(screen.queryByText(/Max Sharpe/i)).not.toBeInTheDocument();
  });

  it('names the plan as the cause only when retention is what clipped the range', async () => {
    mockedUseQuery.mockReturnValue(onPlan(90));
    mockedGetHistory.mockResolvedValue(truncated);
    render(<PortfolioPlanner />);
    await screen.findByText('Apple Inc');
    await switchTab('Frontier');
    await screen.findByText(/Not enough overlapping price history/i, {}, FIND);

    expect(screen.getByText(/Your plan keeps 90 days of price history/i)).toBeInTheDocument();
    expect(screen.getByRole('button', { name: /see plans/i })).toBeInTheDocument();
  });

  it('does not sell an upgrade to an account whose retention is already unlimited', async () => {
    // The state that actually shipped: a maintainer on the staff plan, whose
    // reads were never clipped — the instruments were simply re-keyed in June
    // and the series restarted. Offering them "more history for money" would be
    // selling something they already have.
    mockedUseQuery.mockReturnValue(onPlan(-1));
    mockedGetHistory.mockResolvedValue(truncated);
    render(<PortfolioPlanner />);
    await screen.findByText('Apple Inc');
    await switchTab('Frontier');
    await screen.findByText(/Not enough overlapping price history/i, {}, FIND);

    expect(screen.getByText(/Your plan is not what limits this/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /see plans/i })).not.toBeInTheDocument();
  });

  it('says nothing about plans when entitlements could not be loaded', async () => {
    mockedUseQuery.mockReturnValue({ data: undefined });
    mockedGetHistory.mockResolvedValue(truncated);
    render(<PortfolioPlanner />);
    await screen.findByText('Apple Inc');
    await switchTab('Frontier');
    await screen.findByText(/Not enough overlapping price history/i, {}, FIND);

    expect(screen.queryByRole('button', { name: /see plans/i })).not.toBeInTheDocument();
  });

  it('offers the upgrade route from the notice, and survives config not being mounted', async () => {
    mockedUseQuery.mockReturnValue(onPlan(90));
    mockedGetHistory.mockResolvedValue(truncated);
    render(<PortfolioPlanner />);
    await screen.findByText('Apple Inc');
    await switchTab('Frontier');
    await screen.findByText(/Not enough overlapping price history/i, {}, FIND);

    // `getGlobalConfig` throws when no ConfigProvider has mounted, as here.
    // Clicking must swallow that: a paywall notice is never allowed to be the
    // reason this page falls over.
    await userEvent.click(screen.getByRole('button', { name: /see plans/i }));

    expect(screen.getByText(/Not enough overlapping price history/i)).toBeInTheDocument();
  });

  it('draws the frontier normally once the range is long enough', async () => {
    mockedGetHistory.mockResolvedValue(fullHistory);
    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');

    expect(screen.queryByText(/Not enough overlapping price history/i)).not.toBeInTheDocument();
  });

  it('measures the overlap, not the longest series: one young holding gates the rest', async () => {
    // Exactly the shipped shape — three instruments with years of history and
    // one added last month. The frontier is only as good as the days they share.
    mockedGetHistory.mockResolvedValue([
      ...series(150, 1).map((d) => ({ ticker: 'AAPL', ...d })),
      ...series(300, 2, 60).map((d) => ({ ticker: 'MSFT', ...d }))
    ]);
    render(<PortfolioPlanner />);
    await screen.findByText('Apple Inc');
    await switchTab('Frontier');

    expect(await screen.findByText(/Not enough overlapping price history/i, {}, FIND)).toBeInTheDocument();
  });
});

describe('choosing the estimation basis', () => {
  /** Weekly closes, one per Friday, spanning `weeks` weeks. */
  function weeklySeries(base: number, seed: number, count: number) {
    const out: { date: string; price: number }[] = [];
    const day = new Date('2024-03-22T00:00:00.000Z');
    let price = base;
    for (let i = 0; i < count; i++) {
      price *= 1 + (Math.sin(i + seed) * 0.02 + 0.002);
      out.push({ date: day.toISOString().slice(0, 10), price });
      day.setUTCDate(day.getUTCDate() + 7);
    }
    return out;
  }

  it('estimates from weekly closes when they carry more usable observations', async () => {
    // The shipped shape: five months of daily history against two and a half
    // years of weekly. The frontier should be fitted to the latter.
    const shortDaily = [
      ...series(150, 1, 150).map((d) => ({ ticker: 'AAPL', ...d })),
      ...series(300, 2, 150).map((d) => ({ ticker: 'MSFT', ...d }))
    ];
    const longWeekly = [
      ...weeklySeries(150, 1, 128).map((d) => ({ ticker: 'AAPL', ...d })),
      ...weeklySeries(300, 2, 128).map((d) => ({ ticker: 'MSFT', ...d }))
    ];
    mockedGetHistory.mockImplementation(({ interval }: { interval?: string } = {}) =>
      Promise.resolve(interval === 'weekly' ? longWeekly : shortDaily)
    );

    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await userEvent.click(screen.getByText(/how these numbers are calculated/i));

    // The chip naming the sample, and the formula that annualizes it, must
    // agree — a mismatch between them is the fivefold error this guards.
    expect(await screen.findAllByText(/weekly returns/)).not.toHaveLength(0);
    expect(screen.getByText(/Σ wᵢ·μᵢ × 52\b/)).toBeInTheDocument();
  });

  it('stays on daily closes when they are the deeper series', async () => {
    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await userEvent.click(screen.getByText(/how these numbers are calculated/i));

    expect(await screen.findAllByText(/daily returns/)).not.toHaveLength(0);
    expect(screen.getByText(/Σ wᵢ·μᵢ × 252/)).toBeInTheDocument();
  });
});
