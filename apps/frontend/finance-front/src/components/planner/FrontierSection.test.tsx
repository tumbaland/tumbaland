import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tumbaland/frontend-core')>()),
  useActivePalette: () => ({ divider: '#ccc', text: { primary: '#000', secondary: '#666' } })
}));

import FrontierSection from './FrontierSection';
import { FrontierSim, PricePoint, SimPoint, runFrontierSimulation } from '../../utils/frontierSim';

function series(base: number, seed: number, count = 120): PricePoint[] {
  const out: PricePoint[] = [];
  const day = new Date('2025-01-06T00:00:00.000Z');
  let price = base;
  while (out.length < count) {
    if (![0, 6].includes(day.getUTCDay())) {
      price *= 1 + Math.sin(out.length * (seed + 1)) * 0.01 + 0.0004 * seed;
      out.push({ date: day.toISOString().slice(0, 10), price });
    }
    day.setUTCDate(day.getUTCDate() + 1);
  }
  return out;
}

const tickers = ['A.DEX', 'B.DEX', 'C.DEX', 'D.DEX'];
const sim: FrontierSim = runFrontierSimulation({
  pricesByTicker: Object.fromEntries(tickers.map((t, i) => [t, series(100 + i * 10, i + 1)])),
  quantityByTicker: { 'A.DEX': 10, 'B.DEX': 10, 'C.DEX': 10, 'D.DEX': 10 },
  riskFreeRatePct: 3,
  simulations: 50
})!;

const target = (weights: number[]): SimPoint => ({ ret: 8, vol: 10, sharpe: 0.5, weights });

const renderSection = (targetPortfolio: SimPoint | null, over = {}) =>
  render(
    <FrontierSection
      sim={sim}
      targetPortfolio={targetPortfolio}
      targetVol={null}
      onTargetVolChange={vi.fn()}
      riskFreeRate="3"
      onRiskFreeRateChange={vi.fn()}
      returnMode="shrunk"
      onReturnModeChange={vi.fn()}
      anchorPct="6"
      onAnchorPctChange={vi.fn()}
      maxWeight="40"
      onMaxWeightChange={vi.fn()}
      onRefresh={vi.fn()}
      refreshing={false}
      updatedAt={null}
      limiting={null}
      excluded={[]}
      onExclude={vi.fn()}
      onInclude={vi.fn()}
      totalValue={10_000}
      nameByTicker={{}}
      {...over}
    />
  );

it('says so when the target puts everything in one or two of several funds', () => {
  renderSection(target([0.7, 0.3, 0, 0]));

  expect(screen.getByText(/The target uses only 2 of your 4 funds/)).toBeInTheDocument();
  expect(screen.getByText(/Set a max per holding/)).toBeInTheDocument();
});

it('says nothing about it when the target is spread across the funds', () => {
  renderSection(target([0.3, 0.3, 0.2, 0.2]));

  expect(screen.queryByText(/The target uses only/)).not.toBeInTheDocument();
});

it('says whether the portfolio held is on the frontier, and by how much it falls short', () => {
  renderSection(target([0.3, 0.3, 0.2, 0.2]));

  expect(screen.getByText(/You are (close to|below) the frontier\./)).toBeInTheDocument();
});

it('warns when returns are taken from history alone', () => {
  renderSection(target([0.3, 0.3, 0.2, 0.2]), { returnMode: 'history' });

  expect(screen.getByText(/History only is the noisiest way/)).toBeInTheDocument();
  expect(screen.queryByLabelText('Long-run return (%/yr)')).not.toBeInTheDocument();
});

it('offers the long-run return to blend toward otherwise', () => {
  renderSection(target([0.3, 0.3, 0.2, 0.2]));

  expect(screen.getByLabelText('Long-run return (%/yr)')).toHaveValue('6');
});

it('shows the limit per holding that was chosen', () => {
  renderSection(target([0.3, 0.3, 0.2, 0.2]));

  // MUI Selects do not wire the label to the combobox, so find it through the label
  const label = Array.from(document.querySelectorAll('label')).find((l) => l.textContent === 'Max per holding')!;
  const combobox = label.closest('.MuiFormControl-root')!.querySelector('[role="combobox"]') as HTMLElement;
  expect(combobox).toHaveTextContent('40%');
});

describe('refreshing', () => {
  it('asks for the prices to be reloaded and the frontier solved again', async () => {
    const onRefresh = vi.fn();
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { onRefresh });

    await userEvent.click(screen.getByRole('button', { name: 'Refresh' }));

    expect(onRefresh).toHaveBeenCalledTimes(1);
  });

  it('cannot be pressed again while it is working, and says so', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { refreshing: true });

    expect(screen.getByRole('button', { name: 'Refreshing' })).toBeDisabled();
  });

  it('says when the prices behind the frontier were loaded', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { updatedAt: new Date(2026, 10, 1, 14, 32) });

    expect(screen.getByText(/Updated 14[:.]32/)).toBeInTheDocument();
  });

  it('says nothing about it before the first load has finished', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]));

    expect(screen.queryByText(/Updated/)).not.toBeInTheDocument();
  });
});

describe('a young holding capping the history', () => {
  const limiting = { ticker: 'EXUS.DEX', since: '2024-06-10', yearsWith: 2.4, yearsWithout: 5.5 };

  it('says which holding limits it, and what leaving it out would give', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { limiting });

    expect(screen.getByText(/The history here is 2\.4 years because EXUS\.DEX only has prices since 2024-06-10/)).toBeInTheDocument();
    expect(screen.getByText(/Without it the other funds share 5\.5 years/)).toBeInTheDocument();
  });

  it('offers to leave it out', async () => {
    const onExclude = vi.fn();
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { limiting, onExclude });

    await userEvent.click(screen.getByRole('button', { name: 'Leave out EXUS.DEX' }));

    expect(onExclude).toHaveBeenCalledWith('EXUS.DEX');
  });

  it('says nothing when no holding is holding the history back', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]));

    expect(screen.queryByText(/The history here is/)).not.toBeInTheDocument();
  });

  it('lists what was left out, and lets it back in', async () => {
    const onInclude = vi.fn();
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { excluded: ['EXUS.DEX'], onInclude });

    expect(screen.getByText(/Left out, so their money is not in the plan below/)).toBeInTheDocument();
    await userEvent.click(screen.getByTestId('CancelIcon'));

    expect(onInclude).toHaveBeenCalledWith('EXUS.DEX');
  });
});

describe('the verdict', () => {
  /** The portfolio held, placed `behind` points of return below the frontier at its own risk. */
  const heldBelowFrontier = (behind: number): FrontierSim => {
    const mid = sim.frontier[Math.floor(sim.frontier.length / 2)];
    return {
      ...sim,
      current: { ret: mid.ret - behind, vol: mid.vol, sharpe: 0.4, weights: [0.25, 0.25, 0.25, 0.25] }
    };
  };

  it('calls a small gap close, and says there is no case for rebalancing', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { sim: heldBelowFrontier(0.5) });

    expect(screen.getByText('You are close to the frontier.')).toBeInTheDocument();
    expect(screen.getByText(/no case for rebalancing/)).toBeInTheDocument();
  });

  it('calls a large gap below the frontier, and points to new money first', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { sim: heldBelowFrontier(3) });

    expect(screen.getByText('You are below the frontier.')).toBeInTheDocument();
    expect(screen.getByText(/new money is the cheapest way to start/)).toBeInTheDocument();
    expect(screen.queryByText(/no case for rebalancing/)).not.toBeInTheDocument();
  });

  it('says what the same risk could earn', () => {
    renderSection(target([0.3, 0.3, 0.2, 0.2]), { sim: heldBelowFrontier(3) });

    expect(screen.getByText(/The same risk could earn [\d.]+% \(\+3\.0 points\)/)).toBeInTheDocument();
  });
});
