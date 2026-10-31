import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CalculationBreakdown from './CalculationBreakdown';
import { FrontierSim } from '../../utils/frontierSim';

/**
 * Numbers modelled on the live portfolio the panel was written for: a strong
 * five-month window annualized into a figure whose error bar reaches below zero.
 */
const sim = (overrides: Partial<FrontierSim['breakdown']> = {}): FrontierSim =>
  ({
    tickers: ['VWCE.DEX', 'XNAS.DEX'],
    points: [],
    frontier: [],
    cap: 1,
    model: { mu: [], cov: [], returnSeries: [], periodsPerYear: 252 },
    maxSharpe: { ret: 40, vol: 15, sharpe: 2.5, weights: [0.5, 0.5] },
    minVol: { ret: 30, vol: 12, sharpe: 2.2, weights: [0.7, 0.3] },
    current: { ret: 34, vol: 13.9, sharpe: 2.23, weights: [0.6, 0.4] },
    dataPoints: 105,
    breakdown: {
      basis: 'daily',
      periodsPerYear: 252,
      equivalentTradingDays: 105,
      window: { from: '2026-03-10', to: '2026-08-07', observations: 105, spanDays: 150 },
      assets: [
        {
          ticker: 'VWCE.DEX',
          weight: 0.6,
          meanPeriod: 0.00123,
          annualizedPct: 30.9,
          volPct: 13.2,
          windowReturnPct: 13.4,
          contributionPct: 18.5
        },
        {
          ticker: 'XNAS.DEX',
          weight: 0.4,
          meanPeriod: 0.00175,
          annualizedPct: 44.2,
          volPct: 18.1,
          windowReturnPct: 19.3,
          contributionPct: 15.5
        }
      ],
      correlations: [
        [1, 0.94],
        [0.94, 1]
      ],
      current: {
        arithmeticPct: 34,
        volPct: 13.9,
        varianceDragPct: 1,
        geometricPct: 33,
        sharpe: 2.23,
        standardErrorPct: 21.5,
        ci95: [-8.1, 76.1]
      },
      riskFreeRatePct: 3,
      expected: { mode: 'shrunk', anchorPct: 8, historyWeight: 0.12, perAssetPct: [10.6, 12.4] },
      ...overrides
    }
  }) as FrontierSim;

const names = { 'VWCE.DEX': 'Vanguard FTSE All-World', 'XNAS.DEX': 'Xtrackers NASDAQ 100' };

const open = async () => userEvent.click(screen.getByText(/how these numbers are calculated/i));

it('stays collapsed until asked, so the answer keeps the headline', () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);

  expect(screen.getByText(/how these numbers are calculated/i)).toBeInTheDocument();
  expect(screen.queryByText(/the sample everything is estimated from/i)).not.toBeVisible();
});

it('names the sample: window, observations and how much of a year it covers', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  expect(screen.getByText('2026-03-10 → 2026-08-07')).toBeInTheDocument();
  expect(screen.getByText('105 daily returns')).toBeInTheDocument();
  expect(screen.getByText('150 calendar days')).toBeInTheDocument();
  expect(screen.getByText('41% of a year')).toBeInTheDocument();
});

it('shows each holding with the arithmetic that turns it into a contribution', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  // Located by its display name: the ticker itself also heads a column in the
  // correlation matrix further down.
  const row = screen.getByText('Xtrackers NASDAQ 100').closest('tr')!;
  expect(within(row).getByText('XNAS.DEX')).toBeInTheDocument();
  expect(within(row).getByText('40.0%')).toBeInTheDocument(); // weight
  expect(within(row).getByText('19.3%')).toBeInTheDocument(); // window return
  expect(within(row).getByText('0.175%')).toBeInTheDocument(); // mean daily
  expect(within(row).getByText('44.2%')).toBeInTheDocument(); // annualized
  expect(within(row).getByText('15.5%')).toBeInTheDocument(); // contribution
});

it('shows the contributions summing to the headline return', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  const total = screen.getByText(/sum of the last column/i).closest('tr')!;
  expect(within(total).getByText('34.0%')).toBeInTheDocument();
});

it('substitutes the portfolio\'s own numbers into the formulas', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  expect(screen.getByText(/Σ wᵢ·μᵢ × 252/)).toHaveTextContent('34.0%');
  expect(screen.getByText(/√\(w′Σw × 252\)/)).toHaveTextContent('13.9%');
  expect(screen.getByText(/\(34\.0 − 3\.0\) ÷ 13\.9/)).toHaveTextContent('2.23');
});

it('separates the average year from the compounded one', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  const block = screen.getByText(/variance drag/);
  expect(block).toHaveTextContent('1.0pp');
  expect(block).toHaveTextContent('33.0%');
});

it('warns when the interval still contains a loss', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  expect(screen.getByText(/± 21.5pp/)).toBeInTheDocument();
  expect(screen.getByText(/interval still includes a loss/i)).toBeInTheDocument();
});

it('drops the loss warning once the estimate is comfortably positive', async () => {
  render(
    <CalculationBreakdown
      sim={sim({
        current: {
          arithmeticPct: 9,
          volPct: 12,
          varianceDragPct: 0.7,
          geometricPct: 8.3,
          sharpe: 0.5,
          standardErrorPct: 2,
          ci95: [5.1, 12.9]
        }
      })}
      nameByTicker={names}
    />
  );
  await open();

  expect(screen.queryByText(/interval still includes a loss/i)).not.toBeInTheDocument();
  expect(screen.getByText(/estimated from 105 observations/i)).toBeInTheDocument();
});

it('shows the shrunk figure the frontier actually runs on', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  // 105 / (105 + 756) = 0.12 → 0.12 × 34 + 0.88 × 8 ≈ 11.2%
  expect(screen.getByText(/history weight/)).toHaveTextContent('0.12');
  expect(screen.getByText(/history weight/)).toHaveTextContent('11.2%');
});

it('lists what each holding is assumed to earn beside what history says', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  const section = screen.getByText('6. The returns the frontier assumes').parentElement!;
  expect(within(section).getByText('From history')).toBeInTheDocument();
  expect(within(section).getByText('10.6%')).toBeInTheDocument();
  expect(within(section).getByText('12.4%')).toBeInTheDocument();
});

it('says history is taken as it is when asked to, and gives no blend to show', async () => {
  render(
    <CalculationBreakdown
      sim={sim({ expected: { mode: 'history', anchorPct: 6, historyWeight: 1, perAssetPct: [30.9, 44.2] } })}
      nameByTicker={names}
    />
  );
  await open();

  expect(screen.getByText(/taken as measured over the window/i)).toBeInTheDocument();
  expect(screen.queryByText(/history weight/)).not.toBeInTheDocument();
});

it('says the holdings are assumed to earn the same when history is set aside', async () => {
  render(
    <CalculationBreakdown
      sim={sim({ expected: { mode: 'equal', anchorPct: 5, historyWeight: 0, perAssetPct: [5, 5] } })}
      nameByTicker={names}
    />
  );
  await open();

  expect(screen.getByText(/every holding is assumed to earn the same 5% a year/i)).toBeInTheDocument();
});

it('flags a correlated pair as buying no diversification', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  expect(screen.getAllByText('0.94')).toHaveLength(2);
  expect(screen.getByText(/near 1 mean the pair adds risk/i)).toBeInTheDocument();
});

it('shows only the per-holding inputs when there are no weights to apply', async () => {
  render(
    <CalculationBreakdown
      sim={sim({
        current: null,
        assets: [
          {
            ticker: 'VWCE.DEX',
            weight: null,
            meanPeriod: 0.00123,
            annualizedPct: 30.9,
            volPct: 13.2,
            windowReturnPct: 13.4,
            contributionPct: null
          }
        ]
      })}
      nameByTicker={names}
    />
  );
  await open();

  expect(screen.queryByText(/from those inputs to the headline figures/i)).not.toBeInTheDocument();
  expect(screen.getByText(/how the holdings move together/i)).toBeInTheDocument();
  expect(screen.getAllByText('—').length).toBeGreaterThan(0);
});

it('states the weekly basis and annualizes by 52 rather than 252', async () => {
  render(
    <CalculationBreakdown
      sim={
        {
          ...sim(),
          breakdown: {
            ...sim().breakdown,
            basis: 'weekly',
            periodsPerYear: 52,
            equivalentTradingDays: 615,
            window: { from: '2024-03-22', to: '2026-08-07', observations: 127, spanDays: 868 }
          }
        } as FrontierSim
      }
      nameByTicker={names}
    />
  );
  await open();

  expect(screen.getByText('127 weekly returns')).toBeInTheDocument();
  expect(screen.getByText(/Σ wᵢ·μᵢ × 52/)).toBeInTheDocument();
  expect(screen.getByText(/Estimated from weekly closes/i)).toBeInTheDocument();
  // 127 weekly closes are 615 trading days of market, not 127 — the difference
  // decides how far the projection shrinks the estimate toward its anchor.
  // Scoped to the formula block: "sample" also appears in the section heading.
  expect(screen.getByText(/history weight/)).toHaveTextContent('615 trading days');
  expect(screen.getByText(/history weight/)).toHaveTextContent('0.45');

  // The conversion is printed as the exact ratio, because 127 × 5 is 635 and
  // the panel would be showing a sum that does not come out.
  expect(screen.getByText(/history weight/)).toHaveTextContent('127 weekly × 252/52');

  // Every basis-dependent noun follows the basis. A weekly fit describing its
  // own inputs as "daily" is the one error this panel cannot afford, since its
  // entire purpose is to let the reader audit the annualization.
  expect(screen.getByText(/covariance matrix of weekly returns/i)).toBeInTheDocument();
  expect(screen.getByText(/portfolio's weekly variance/i)).toBeInTheDocument();
  expect(screen.getByText(/Correlations of weekly returns/i)).toBeInTheDocument();
});

it('describes a daily fit in daily terms throughout', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  expect(screen.getByText(/covariance matrix of daily returns/i)).toBeInTheDocument();
  expect(screen.getByText(/portfolio's daily variance/i)).toBeInTheDocument();
  expect(screen.getByText(/Correlations of daily returns/i)).toBeInTheDocument();

  // A daily sample is already in trading days, so no conversion is shown.
  expect(screen.getByText(/history weight/)).toHaveTextContent('105 daily');
  expect(screen.getByText(/history weight/)).not.toHaveTextContent('× 252/252');
});
