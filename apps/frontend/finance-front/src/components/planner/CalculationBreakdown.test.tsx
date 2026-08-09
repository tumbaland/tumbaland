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
    maxSharpe: { ret: 40, vol: 15, sharpe: 2.5, weights: [0.5, 0.5] },
    minVol: { ret: 30, vol: 12, sharpe: 2.2, weights: [0.7, 0.3] },
    current: { ret: 34, vol: 13.9, sharpe: 2.23, weights: [0.6, 0.4] },
    dataPoints: 105,
    breakdown: {
      window: { from: '2026-03-10', to: '2026-08-07', observations: 105, spanDays: 150 },
      assets: [
        {
          ticker: 'VWCE.DEX',
          weight: 0.6,
          meanDaily: 0.00123,
          annualizedPct: 30.9,
          volPct: 13.2,
          windowReturnPct: 13.4,
          contributionPct: 18.5
        },
        {
          ticker: 'XNAS.DEX',
          weight: 0.4,
          meanDaily: 0.00175,
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

it('shows the shrunk figure the projection tab actually runs on', async () => {
  render(<CalculationBreakdown sim={sim()} nameByTicker={names} />);
  await open();

  // 105 / (105 + 756) = 0.12 → 0.12 × 34 + 0.88 × 8 ≈ 11.2%
  expect(screen.getByText(/history weight/)).toHaveTextContent('0.12');
  expect(screen.getByText(/projection input/)).toHaveTextContent('11.2%');
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
            meanDaily: 0.00123,
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
