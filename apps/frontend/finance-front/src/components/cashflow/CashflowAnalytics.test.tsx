import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

// The charts render an SVG that jsdom cannot measure; these stubs keep the
// assertions on the numbers and labels rather than on chart internals.
type MockSeries = { label: string; data: number[]; valueFormatter?: (v: number | null) => string };
type MockAxis = { data?: string[]; valueFormatter?: (v: never) => string };

/**
 * The charts render an SVG jsdom cannot measure. These stubs keep the
 * assertions on the numbers and labels — and run the formatters, so what a
 * tooltip and an axis would actually show is under test rather than assumed.
 */
vi.mock('@mui/x-charts/BarChart', () => ({
  // There is more than one bar chart on the page, so the stub keys its test ids
  // off the className the component passes — otherwise every query is ambiguous.
  BarChart: ({
    series,
    xAxis,
    yAxis,
    className
  }: {
    series: MockSeries[];
    xAxis?: MockAxis[];
    yAxis?: MockAxis[];
    className?: string;
  }) => {
    const id = className === 'chart-invested' ? 'invested' : 'bar';
    return (
      <div>
        <div data-testid={`${id}-chart`}>{series.map((s) => `${s.label}:${s.data.join(',')}`).join(' | ')}</div>
        <div data-testid={`${id}-tooltip`}>
          {series.map((s) => `${s.label}=${s.valueFormatter?.(s.data[0] ?? null) ?? ''}`).join(' | ')}
        </div>
        <div data-testid={`${id}-xaxis`}>
          {(xAxis?.[0]?.data || []).map((v) => xAxis?.[0]?.valueFormatter?.(v as never) ?? v).join(' | ')}
        </div>
        <div data-testid={`${id}-yaxis`}>{yAxis?.[0]?.valueFormatter?.(12500 as never) ?? ''}</div>
      </div>
    );
  }
}));
vi.mock('@mui/x-charts/LineChart', () => ({
  LineChart: ({ series, xAxis }: { series: MockSeries[]; xAxis?: MockAxis[] }) => (
    <div>
      <div data-testid="line-chart">{series.map((s) => `${s.label}:${s.data.join(',')}`).join(' | ')}</div>
      <div data-testid="line-xaxis">
        {(xAxis?.[0]?.data || []).map((v) => xAxis?.[0]?.valueFormatter?.(v as never) ?? v).join(' | ')}
      </div>
    </div>
  )
}));

import CashflowAnalytics from './CashflowAnalytics';
import { Analytics } from '../../services/cashflowService';

const year = (y: number, income: number, expense: number, over: Record<string, unknown> = {}) => ({
  year: y, income, expense, consumption: expense, invested: 0, divested: 0,
  savings: income - expense,
  savingsRate: income > 0 ? ((income - expense) / income) * 100 : null,
  months: 12, from: `${y}-01`, to: `${y}-12`, partial: false,
  incomeChange: null, incomeChangePct: null, expenseChange: null, expenseChangePct: null,
  ...over
});

const trailing = {
  current: {
    income: 50000, expense: 15000, consumption: 15000, invested: 0, divested: 0,
    savings: 35000, savingsRate: 70, months: 12, from: '2025-01', to: '2025-12'
  },
  previous: {
    income: 40000, expense: 20000, consumption: 20000, invested: 0, divested: 0,
    savings: 20000, savingsRate: 50, months: 12, from: '2024-01', to: '2024-12'
  }
};

const analytics: Analytics = {
  trailing,
  years: [
    year(2024, 40000, 20000),
    year(2025, 50000, 15000, { incomeChange: 10000, incomeChangePct: 25, expenseChange: -5000, expenseChangePct: -25 })
  ],
  months: [
    { period: '2025-01', income: 4000, expense: 5200, consumption: 1200, invested: 4000, savings: 2800 },
    { period: '2025-02', income: 4000, expense: 1400, consumption: 1400, invested: 0, savings: 2600 }
  ],
  categoryTrends: [
    { category: 'Groceries', byYear: { 2024: 1000, 2025: 1500 }, total: 2500, latest: 1500, previous: 1000, change: 500, changePct: 50, perMonth: 125 },
    { category: 'Travel', byYear: { 2024: 800, 2025: 200 }, total: 1000, latest: 200, previous: 800, change: -600, changePct: -75, perMonth: 17 }
  ],
  incomeSources: [],
  investmentCategories: ['Investments', 'Savings'],
  currency: 'EUR'
};

it('renders nothing when there is no series', () => {
  const { container } = render(
    <CashflowAnalytics analytics={{ ...analytics, years: [], months: [] }} />
  );
  expect(container).toBeEmptyDOMElement();
});

it('starts on monthly and charts the month series', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Income:4000,4000');
  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Spending:1200,1400');
});

it('switches to the yearly series', async () => {
  render(<CashflowAnalytics analytics={analytics} />);

  await userEvent.click(screen.getByRole('button', { name: 'Yearly' }));

  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Income:40000,50000');
  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Spending:20000,15000');
});

it('draws a trailing average line alongside the bars', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  // 1200 then (1200+1400)/2
  expect(screen.getByTestId('line-chart')).toHaveTextContent('Spending average:1200,1300');
});

it('describes a typical period rather than a trend line', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText('Spending — a typical month')).toBeInTheDocument();
  // The two months are 1200 and 1400, so the middle is 1300
  expect(screen.getByText('1300 €')).toBeInTheDocument();
  expect(screen.getAllByText(/middle of the last 2 months/).length).toBe(2);
});

it('gives the range beside the median, so it does not read as a budget', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText(/Quietest 1200 € · heaviest 1400 €/)).toBeInTheDocument();
});

it('compares the newest period against typical, not against the one before', () => {
  // Against the previous month, a part-imported month reads as a collapse
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText(/Feb 2025: 1400 € — 100 € above typical/)).toBeInTheDocument();
});

it('draws the shape of the window under the number', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(
    screen.getByLabelText('Spending over the last 2 months, ending at 1400 €')
  ).toBeInTheDocument();
});

it('marks a part year in the year table as not comparable', () => {
  render(
    <CashflowAnalytics
      analytics={{
        ...analytics,
        years: [analytics.years[0], { ...analytics.years[1], partial: true, months: 3 }]
      }}
    />
  );

  expect(screen.getByText('3 mo')).toBeInTheDocument();
});

it('says the movers are compared on trailing windows, not calendar years', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText(/against the 12 months before/)).toBeInTheDocument();
});

it('relabels the period when switched to yearly', async () => {
  render(<CashflowAnalytics analytics={analytics} />);

  await userEvent.click(screen.getByRole('button', { name: 'Yearly' }));

  expect(screen.getByText('Spending — a typical year')).toBeInTheDocument();
  expect(screen.getByText('Income — a typical year')).toBeInTheDocument();
});

it('shows the year-on-year table newest first', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  const rows = screen.getAllByRole('row').map((r) => r.textContent);
  const dataRows = rows.filter((r) => r?.match(/202\d/));
  expect(dataRows[0]).toContain('2025');
  expect(dataRows[1]).toContain('2024');
});

it('gives the year-on-year table amounts, not percentages', () => {
  // +266% off a year whose income mostly landed as capital returning says
  // nothing, and a part year against a full one is not a comparison at all
  render(<CashflowAnalytics analytics={analytics} />);

  const table = screen.getByText('Year on year').closest('.MuiCardContent-root') as HTMLElement;
  expect(within(table).queryByText('+25.0%')).not.toBeInTheDocument();
  expect(within(table).queryByText('-25.0%')).not.toBeInTheDocument();
  expect(within(table).queryByRole('columnheader', { name: 'vs prev' })).not.toBeInTheDocument();
  expect(within(table).queryByRole('columnheader', { name: 'Rate' })).not.toBeInTheDocument();
});

it('keeps the euro columns that carry the story', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  const table = screen.getByText('Year on year').closest('.MuiCardContent-root') as HTMLElement;
  for (const header of ['Year', 'Income', 'Spending', 'Invested', 'Returned', 'Saved']) {
    expect(within(table).getByRole('columnheader', { name: header })).toBeInTheDocument();
  }
});

it('dashes a year with nothing invested rather than showing a zero', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  const table = screen.getByText('Year on year').closest('.MuiCardContent-root') as HTMLElement;
  expect(within(table).getAllByText('—').length).toBeGreaterThan(0);
});

it('ranks the biggest movers by absolute change, not by total', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText('Biggest movers in spending')).toBeInTheDocument();
  // Travel moved 600 against Groceries' 500, so it leads despite a smaller total
  const movers = screen.getAllByText(/^(Groceries|Travel)$/).map((el) => el.textContent);
  expect(movers[0]).toBe('Travel');
});

describe('chart formatting', () => {
  it('labels a month axis point readably rather than as a raw key', () => {
    render(<CashflowAnalytics analytics={analytics} />);

    expect(screen.getByTestId('bar-xaxis')).toHaveTextContent('Jan 2025 | Feb 2025');
    expect(screen.getByTestId('line-xaxis')).toHaveTextContent('Jan 2025');
  });

  it('shows whole euros in the tooltip, not raw floats', () => {
    render(<CashflowAnalytics analytics={analytics} />);

    expect(screen.getByTestId('bar-tooltip')).toHaveTextContent('Income=4000 €');
    expect(screen.getByTestId('bar-tooltip')).toHaveTextContent('Spending=1200 €');
  });

  it('abbreviates the value axis so ticks stay short', () => {
    render(<CashflowAnalytics analytics={analytics} />);

    expect(screen.getByTestId('bar-yaxis')).toHaveTextContent('13k €');
  });

  it('leaves a year label alone when switched to yearly', async () => {
    render(<CashflowAnalytics analytics={analytics} />);

    await userEvent.click(screen.getByRole('button', { name: 'Yearly' }));

    expect(screen.getByTestId('bar-xaxis')).toHaveTextContent('2024 | 2025');
  });
});

it('plots consumption under the Spending label, never the gross outflow', () => {
  // A month that put 4000 into ETFs must not read as 5200 of spending
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByTestId('bar-chart')).toHaveTextContent('Spending:1200,1400');
  expect(screen.getByTestId('bar-chart')).not.toHaveTextContent('Spending:5200');
});

it('gives investing its own chart, so it cannot flatten income and spending', () => {
  // A 122k year of ETF buying on a shared axis squashes a 1200 month of
  // spending into the baseline, which is the comparison the chart is for
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByTestId('invested-chart')).toHaveTextContent('Invested:4000,0');
  expect(screen.getByTestId('bar-chart')).not.toHaveTextContent('Invested');
  expect(screen.getByText(/left the account but was not spent/)).toBeInTheDocument();
});

it('lines the invested chart up with the same periods', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByTestId('invested-xaxis')).toHaveTextContent(
    screen.getByTestId('bar-xaxis').textContent as string
  );
});

it('says the invested chart is on a scale of its own', () => {
  render(<CashflowAnalytics analytics={analytics} />);

  expect(screen.getByText(/its own scale/)).toBeInTheDocument();
});

it('drops the invested chart entirely when there is none', () => {
  render(
    <CashflowAnalytics
      analytics={{
        ...analytics,
        months: analytics.months.map((m) => ({ ...m, expense: m.consumption, invested: 0 }))
      }}
    />
  );

  expect(screen.queryByTestId('invested-chart')).not.toBeInTheDocument();
  expect(screen.getByTestId('bar-chart')).not.toHaveTextContent('Invested');
});

it('shows capital that came back beside what went in', () => {
  render(
    <CashflowAnalytics
      analytics={{
        ...analytics,
        years: [{ ...analytics.years[0], invested: 9026, divested: 16523 }]
      }}
    />
  );

  expect(screen.getByText('9026 €')).toBeInTheDocument();
  expect(screen.getByText('16 523 €')).toBeInTheDocument();
});

describe('biggest movers', () => {
  const withTrends = (trends: Analytics['categoryTrends']) => ({ ...analytics, categoryTrends: trends });
  const trend = (over: Partial<Analytics['categoryTrends'][0]>) => ({
    category: 'X', byYear: {}, total: 0, latest: 0, previous: 0, change: 0, changePct: null, perMonth: 0, ...over
  });

  it('leads with the euro change, which is comparable across categories', () => {
    render(<CashflowAnalytics analytics={analytics} />);

    expect(screen.getByText('+500 €')).toBeInTheDocument();
    expect(screen.getByText('−600 €')).toBeInTheDocument();
  });

  it('says "new" instead of a percentage off nothing', () => {
    // Cash went 0 € → 3350 €, which the old card rendered as "+3350 €" ranked
    // as if it were a percentage
    render(
      <CashflowAnalytics
        analytics={withTrends([trend({ category: 'Cash', latest: 3350, previous: 0, change: 3350 })])}
      />
    );

    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByText('+3350 €')).toBeInTheDocument();
  });

  it('says "stopped" when a category went to nothing', () => {
    render(
      <CashflowAnalytics
        analytics={withTrends([
          trend({ category: 'Gym', latest: 0, previous: 400, change: -400, changePct: -100 })
        ])}
      />
    );

    expect(screen.getByText('stopped')).toBeInTheDocument();
  });

  it('refuses a percentage off a base too small to carry one', () => {
    // 87 € → 710 € is not "+717%", it is a category that barely existed
    render(
      <CashflowAnalytics
        analytics={withTrends([
          trend({ category: 'Subscriptions', latest: 710, previous: 87, change: 623, changePct: 716.1 })
        ])}
      />
    );

    expect(screen.getByText('from a small base')).toBeInTheDocument();
    expect(screen.queryByText(/716|717/)).not.toBeInTheDocument();
  });

  it('keeps the percentage when the base is big enough to mean something', () => {
    render(
      <CashflowAnalytics
        analytics={withTrends([
          trend({ category: 'Transport', latest: 2496, previous: 2209, change: 287, changePct: 13.0 })
        ])}
      />
    );

    expect(screen.getByText('+13.0%')).toBeInTheDocument();
  });
});
