import { render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import CategoryMovers from './CategoryMovers';
import { Analytics, CategoryTrend } from '../../services/cashflowService';

const trend = (over: Partial<CategoryTrend>): CategoryTrend => ({
  category: 'X',
  byYear: {},
  total: 0,
  latest: 0,
  previous: 0,
  change: 0,
  changePct: null,
  perMonth: 0,
  ...over
});

const trailing: Analytics['trailing'] = {
  current: {
    income: 50_000, expense: 15_000, consumption: 15_000, invested: 0, divested: 0,
    savings: 35_000, savingsRate: 70, months: 12, from: '2025-08', to: '2026-07'
  },
  previous: {
    income: 40_000, expense: 20_000, consumption: 20_000, invested: 0, divested: 0,
    savings: 20_000, savingsRate: 50, months: 12, from: '2024-08', to: '2025-07'
  }
};

const trends = [
  trend({ category: 'Groceries', latest: 4600, previous: 4100, change: 500, changePct: 12.2 }),
  trend({ category: 'Travel', latest: 900, previous: 1500, change: -600, changePct: -40 }),
  trend({ category: 'Rent', latest: 10_800, previous: 10_700, change: 100, changePct: 0.9 })
];

const renderMovers = (rows = trends) =>
  render(<CategoryMovers trends={rows} trailing={trailing} />);

/** The category in each body row, top to bottom. */
const order = () =>
  screen
    .getAllByRole('row')
    .slice(1)
    .map((row) => within(row).getAllByRole('cell')[0].textContent);

it('renders nothing when no category has been categorised', () => {
  const { container } = render(<CategoryMovers trends={[]} trailing={trailing} />);

  expect(container).toBeEmptyDOMElement();
});

it('lays the two periods and the variance out as columns', () => {
  renderMovers();

  for (const header of ['Category', 'Current 12M', 'Previous 12M', 'Variance']) {
    expect(screen.getByRole('columnheader', { name: header })).toBeInTheDocument();
  }
});

it('says the comparison runs on trailing windows, not calendar years', () => {
  // In March, "this year" is two months against twelve and every category
  // would look like it had collapsed
  renderMovers();

  expect(screen.getByText(/Aug 2025–Jul 2026 against the 12 months before/)).toBeInTheDocument();
});

it('opens on the biggest movers, whichever way they moved', () => {
  renderMovers();

  // Travel fell 600 against Groceries' 500 rise, so it leads despite spending less
  expect(order()).toEqual(['Travel', 'Groceries', 'Rent']);
});

it('flips to the smallest movers on a second click', async () => {
  renderMovers();

  await userEvent.click(screen.getByRole('button', { name: 'Variance' }));

  expect(order()).toEqual(['Rent', 'Groceries', 'Travel']);
});

it('sorts by what each period cost when asked', async () => {
  renderMovers();

  await userEvent.click(screen.getByRole('button', { name: 'Current 12M' }));

  expect(order()).toEqual(['Rent', 'Groceries', 'Travel']);
});

it('sorts by the period being compared against', async () => {
  renderMovers();

  await userEvent.click(screen.getByRole('button', { name: 'Previous 12M' }));

  expect(order()).toEqual(['Rent', 'Groceries', 'Travel']);
});

it('sorts by name from A down, not from Z', async () => {
  renderMovers();

  await userEvent.click(screen.getByRole('button', { name: 'Category' }));

  expect(order()).toEqual(['Groceries', 'Rent', 'Travel']);
});

it('leads with the euro change, which is comparable across categories', () => {
  renderMovers();

  expect(screen.getByText(/\+500 €/)).toBeInTheDocument();
  expect(screen.getByText(/−600 €/)).toBeInTheDocument();
});

it('shows both periods so the variance can be checked', () => {
  renderMovers();

  expect(screen.getByText('4600 €')).toBeInTheDocument();
  expect(screen.getByText('4100 €')).toBeInTheDocument();
});

describe('the percentage footnote', () => {
  it('says "new" instead of a percentage off nothing', () => {
    renderMovers([trend({ category: 'Cash', latest: 3350, previous: 0, change: 3350 })]);

    expect(screen.getByText('new')).toBeInTheDocument();
    expect(screen.getByText(/\+3350 €/)).toBeInTheDocument();
  });

  it('says "stopped" when a category went to nothing', () => {
    renderMovers([
      trend({ category: 'Gym', latest: 0, previous: 400, change: -400, changePct: -100 })
    ]);

    expect(screen.getByText('stopped')).toBeInTheDocument();
  });

  it('refuses a percentage off a base too small to carry one', () => {
    // 87 € → 710 € is not "+717%", it is a category that barely existed
    renderMovers([
      trend({ category: 'Subscriptions', latest: 710, previous: 87, change: 623, changePct: 716.1 })
    ]);

    expect(screen.getByText('from a small base')).toBeInTheDocument();
    expect(screen.queryByText(/716|717/)).not.toBeInTheDocument();
  });

  it('keeps the percentage when the base is big enough to mean something', () => {
    renderMovers([
      trend({ category: 'Transport', latest: 2496, previous: 2209, change: 287, changePct: 13.0 })
    ]);

    expect(screen.getByText('+13.0%')).toBeInTheDocument();
  });
});
