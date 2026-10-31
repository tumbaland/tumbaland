import { render, screen, waitFor, fireEvent, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

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

vi.mock('@tumbaland/frontend-core', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/frontend-core')>();
  return { ...actual, useTenantFilter: () => undefined };
});

vi.mock('../hooks/useHoldings', () => ({ useHoldings: vi.fn() }));
vi.mock('../hooks/useTrackedTicker', () => ({ useTrackedTickers: vi.fn() }));
// The Plan tab starts from the dashboard; this file is about the other tabs.
vi.mock('../hooks/useDashboard', () => ({ useDashboard: () => ({ data: undefined, isLoading: false }) }));
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

// The frontier is worked out after prices load, so results appear asynchronously —
// allow generous find timeouts.
const FIND = { timeout: 4000 };

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

it('opens on the plan, with the other tabs beside it', async () => {
  render(<PortfolioPlanner />);

  expect(await screen.findByRole('tab', { name: 'Plan', selected: true })).toBeInTheDocument();
  expect(screen.getByRole('tab', { name: 'Frontier', selected: false })).toBeInTheDocument();
  // Holdings live on the Investments page, with live prices and gains
  expect(screen.queryByRole('tab', { name: 'Holdings' })).not.toBeInTheDocument();
  // The old growth calculator is gone; the Plan tab covers it
  expect(screen.queryByRole('tab', { name: 'Projection' })).not.toBeInTheDocument();
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

it('has no frontier without holdings, and says where to add them', async () => {
  mockedUseHoldings.mockReturnValue({ data: [], isLoading: false });
  render(<PortfolioPlanner />);

  expect(await screen.findByText(/add holdings in the investments page/i)).toBeInTheDocument();
  expect(screen.queryByText('Efficient Frontier')).not.toBeInTheDocument();
});

it('renders the solved efficient frontier once prices load', async () => {
  render(<PortfolioPlanner />);

  // The calculation breakdown names each instrument it explains
  expect(await screen.findAllByText('Apple Inc')).not.toHaveLength(0);
  expect(screen.getAllByText('Microsoft Corp')).not.toHaveLength(0);
  expect(screen.queryByText(/no price history for/i)).not.toBeInTheDocument();

  expect(await screen.findByText('Efficient Frontier')).toBeInTheDocument();
  expect(screen.getByText(/Solved, long-only/)).toBeInTheDocument();
  expect(screen.getByText('What to Buy Next')).toBeInTheDocument();
  expect(screen.getByText('Your Portfolio')).toBeInTheDocument();
  expect(screen.getByText('★ Max Sharpe')).toBeInTheDocument();
  expect(screen.getByText('● Min Risk')).toBeInTheDocument();
  // what the weights alone do not show
  expect(screen.getByText('Where the risk comes from')).toBeInTheDocument();
  expect(screen.getByText('What it would have been through')).toBeInTheDocument();
  // and no random sampling to re-run by hand
  expect(screen.queryByRole('button', { name: /re-run/i })).not.toBeInTheDocument();
});

it('says whether the portfolio held is on the frontier', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');

  expect(screen.getByText(/You are (close to|below) the frontier\./)).toBeInTheDocument();
  expect(screen.getByText(/You hold [\d.]+% risk for [\d.]+% expected return/)).toBeInTheDocument();
});

it('blends history toward the long run by default, and can be told to use history alone', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');

  const combobox = () => {
    const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Expected returns')!;
    return label.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  };
  expect(combobox()).toHaveTextContent('History, blended with the long run');
  expect(screen.queryByText(/History only is the noisiest way/)).not.toBeInTheDocument();
  expect(hasFormLabel('Long-run return (%/yr)')).toBe(true);

  await selectOption('Expected returns', 'History only');

  expect(await screen.findByText(/History only is the noisiest way/)).toBeInTheDocument();
  // nothing to blend toward, so no long-run figure to set
  expect(hasFormLabel('Long-run return (%/yr)')).toBe(false);
});

it('can give every holding the same return, so risk alone decides', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');

  await selectOption('Expected returns', 'All the same, risk decides');

  expect(hasFormLabel('Long-run return (%/yr)')).toBe(true);
  expect(screen.queryByText(/History only is the noisiest way/)).not.toBeInTheDocument();
});

it('limits any one holding to 40% by default, so the answer is not a pair of funds', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');

  const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Max per holding')!;
  const combobox = label.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  expect(combobox).toHaveTextContent('40%');
});

it('keeps any one holding under the chosen limit', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Frontier');

  await selectOption('Max per holding', '50%');

  // two holdings, so a 50% limit forces an even split in the target
  await waitFor(() => {
    const table = screen.getByRole('table', { name: 'Where the risk comes from' });
    const targets = within(table).getAllByRole('row').slice(1).map((row) => within(row).getAllByRole('cell')[3].textContent);
    targets.forEach((cell) => expect(parseFloat(cell!.replace('%', ''))).toBeCloseTo(50, 0));
  });
});

describe('refresh', () => {
  const refresh = () => userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

  it('reloads the price history, for both series, and solves the frontier again', async () => {
    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await switchTab('Frontier');
    const before = mockedGetHistory.mock.calls.length;

    await refresh();

    // two tickers, daily and weekly
    await waitFor(() => expect(mockedGetHistory.mock.calls.length).toBe(before * 2));
    expect(screen.getByText('Efficient Frontier')).toBeInTheDocument();
  });

  it('keeps what was typed into the buy plan, instead of replacing the page with a spinner', async () => {
    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await switchTab('Frontier');

    const invest = screen.getByLabelText('Invest (€)');
    await userEvent.clear(invest);
    await userEvent.type(invest, '2500');
    await refresh();

    expect(screen.queryByRole('progressbar', { name: '' })).toBeNull();
    await waitFor(() => expect(screen.getByRole('button', { name: 'Refresh' })).toBeEnabled());
    expect(screen.getByLabelText('Invest (€)')).toHaveValue('2500');
  });

  it('is disabled while the prices are loading', async () => {
    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await switchTab('Frontier');
    mockedGetHistory.mockReturnValue(new Promise(() => {}));

    await refresh();

    expect(await screen.findByRole('button', { name: 'Refreshing' })).toBeDisabled();
    expect(screen.getByText('Efficient Frontier')).toBeInTheDocument();
  });
});

it('solves the frontier again when the risk-free rate changes, with nothing to re-run by hand', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Frontier');

  const riskFreeInput = screen.getByLabelText('Risk-free (%/yr)');
  await userEvent.clear(riskFreeInput);
  await userEvent.type(riskFreeInput, '5');

  expect(riskFreeInput).toHaveValue('5');
  expect(screen.getByText('Efficient Frontier')).toBeInTheDocument();
  expect(localStorage.getItem('finance-planner-risk-free-rate')).toBe('"5"');
});

it('warns about holdings missing price history and skips the frontier below 2 tickers', async () => {
  mockedGetHistory.mockResolvedValue(fullHistory.filter((d) => d.ticker === 'AAPL'));
  render(<PortfolioPlanner />);

  expect(await screen.findByText(/no price history for: MSFT/i)).toBeInTheDocument();
  expect(await screen.findByText(/need price history for at least 2 holdings/i)).toBeInTheDocument();
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

it('follows the best Sharpe ratio until the slider is moved, and does not save that default', async () => {
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Frontier');

  const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
  const maxSharpe = parseFloat(screen.getByText(/% Max Sharpe/).textContent!.match(/[\d.]+/)![0]);
  expect(parseFloat(slider.value)).toBeCloseTo(maxSharpe, 1);
  expect(localStorage.getItem('finance-planner-target-vol')).toBeNull();
});

it('ignores a saved risk level the frontier no longer reaches, instead of sticking at the minimum', async () => {
  // Saved by an earlier run, below what the frontier can do now
  localStorage.setItem('finance-planner-target-vol', JSON.stringify(0.5));
  render(<PortfolioPlanner />);
  await screen.findByText('Efficient Frontier');
  await switchTab('Frontier');

  const slider = document.querySelector('input[type="range"]') as HTMLInputElement;
  const min = parseFloat(slider.min);
  const maxSharpe = parseFloat(screen.getByText(/% Max Sharpe/).textContent!.match(/[\d.]+/)![0]);
  expect(parseFloat(slider.value)).toBeCloseTo(maxSharpe, 1);
  expect(parseFloat(slider.value)).toBeGreaterThanOrEqual(min);
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
    await screen.findByRole('tab', { name: 'Frontier' });
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
    await screen.findByRole('tab', { name: 'Frontier' });
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
    await screen.findByRole('tab', { name: 'Frontier' });
    await switchTab('Frontier');
    await screen.findByText(/Not enough overlapping price history/i, {}, FIND);

    expect(screen.getByText(/Your plan is not what limits this/i)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /see plans/i })).not.toBeInTheDocument();
  });

  it('says nothing about plans when entitlements could not be loaded', async () => {
    mockedUseQuery.mockReturnValue({ data: undefined });
    mockedGetHistory.mockResolvedValue(truncated);
    render(<PortfolioPlanner />);
    await screen.findByRole('tab', { name: 'Frontier' });
    await switchTab('Frontier');
    await screen.findByText(/Not enough overlapping price history/i, {}, FIND);

    expect(screen.queryByRole('button', { name: /see plans/i })).not.toBeInTheDocument();
  });

  it('offers the upgrade route from the notice, and survives config not being mounted', async () => {
    mockedUseQuery.mockReturnValue(onPlan(90));
    mockedGetHistory.mockResolvedValue(truncated);
    render(<PortfolioPlanner />);
    await screen.findByRole('tab', { name: 'Frontier' });
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
    await screen.findByRole('tab', { name: 'Frontier' });
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

  it('prefers weekly closes that reach clearly further, even when daily has more observations', async () => {
    // The live case: about 165 daily closes over eight months against about 125
    // weekly ones over two and a half years. Counting observations chose daily.
    const daily = [
      ...series(150, 1, 230).map((d) => ({ ticker: 'AAPL', ...d })),
      ...series(300, 2, 230).map((d) => ({ ticker: 'MSFT', ...d }))
    ];
    const weekly = [
      ...weeklySeries(150, 1, 126).map((d) => ({ ticker: 'AAPL', ...d })),
      ...weeklySeries(300, 2, 126).map((d) => ({ ticker: 'MSFT', ...d }))
    ];
    mockedGetHistory.mockImplementation(({ interval }: { interval?: string } = {}) =>
      Promise.resolve(interval === 'weekly' ? weekly : daily)
    );

    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await userEvent.click(screen.getByText(/how these numbers are calculated/i));

    expect(await screen.findAllByText(/weekly returns/)).not.toHaveLength(0);
  });

  it('keeps daily closes when weekly reaches only a little further', async () => {
    const daily = [
      ...series(150, 1, 700).map((d) => ({ ticker: 'AAPL', ...d })),
      ...series(300, 2, 700).map((d) => ({ ticker: 'MSFT', ...d }))
    ];
    const weekly = [
      ...weeklySeries(150, 1, 110).map((d) => ({ ticker: 'AAPL', ...d })),
      ...weeklySeries(300, 2, 110).map((d) => ({ ticker: 'MSFT', ...d }))
    ];
    mockedGetHistory.mockImplementation(({ interval }: { interval?: string } = {}) =>
      Promise.resolve(interval === 'weekly' ? weekly : daily)
    );

    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await userEvent.click(screen.getByText(/how these numbers are calculated/i));

    expect(await screen.findAllByText(/daily returns/)).not.toHaveLength(0);
  });

  it('stays on daily closes when they are the deeper series', async () => {
    render(<PortfolioPlanner />);
    await screen.findByText('Efficient Frontier');
    await userEvent.click(screen.getByText(/how these numbers are calculated/i));

    expect(await screen.findAllByText(/daily returns/)).not.toHaveLength(0);
    expect(screen.getByText(/Σ wᵢ·μᵢ × 252/)).toBeInTheDocument();
  });
});

describe('a young holding capping the history', () => {
  const four = [
    { _id: 'h1', ticker: 'AAPL', quantity: 10, avgBuyPrice: 100 },
    { _id: 'h2', ticker: 'MSFT', quantity: 5, avgBuyPrice: 200 },
    { _id: 'h3', ticker: 'NVDA', quantity: 4, avgBuyPrice: 120 },
    { _id: 'h4', ticker: 'NEWF', quantity: 8, avgBuyPrice: 50 }
  ];
  const histories = [
    ...series(150, 1).map((d) => ({ ticker: 'AAPL', ...d })),
    ...series(300, 2).map((d) => ({ ticker: 'MSFT', ...d })),
    ...series(80, 3).map((d) => ({ ticker: 'NVDA', ...d })),
    // listed much later than the rest, so it caps everyone's history
    ...series(50, 4).slice(-260).map((d) => ({ ticker: 'NEWF', ...d }))
  ];

  beforeEach(() => {
    mockedUseHoldings.mockReturnValue({ data: four, isLoading: false });
    mockedGetHistory.mockImplementation(({ interval }: { interval?: string } = {}) =>
      Promise.resolve(interval === 'weekly' ? [] : histories)
    );
  });

  it('names it and offers to leave it out', async () => {
    render(<PortfolioPlanner />);
    await screen.findByRole('tab', { name: 'Frontier' });
    await switchTab('Frontier');

    expect(await screen.findByRole('button', { name: 'Leave out NEWF' }, FIND)).toBeInTheDocument();
    expect(screen.getByText(/because NEWF only has prices since/)).toBeInTheDocument();
  });

  it('leaves it out on request, lengthens the history, and lets it back in', async () => {
    render(<PortfolioPlanner />);
    await screen.findByRole('tab', { name: 'Frontier' });
    await switchTab('Frontier');
    await userEvent.click(await screen.findByRole('button', { name: 'Leave out NEWF' }, FIND));

    expect(await screen.findByText(/Left out, so their money is not in the plan below/)).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: 'Leave out NEWF' })).not.toBeInTheDocument();
    // not a "no price history" warning: it was left out on purpose
    expect(screen.queryByText(/No price history for: NEWF/)).not.toBeInTheDocument();
    expect(localStorage.getItem('finance-planner-excluded')).toBe('["NEWF"]');

    await userEvent.click(screen.getByTestId('CancelIcon'));

    expect(await screen.findByRole('button', { name: 'Leave out NEWF' })).toBeInTheDocument();
    expect(screen.queryByText(/Left out, so their money/)).not.toBeInTheDocument();
  });
});
