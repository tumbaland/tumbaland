import { render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

vi.mock('@tumbaland/frontend-core', async (importOriginal) => ({
  ...(await importOriginal<typeof import('@tumbaland/frontend-core')>()),
  useTenantFilter: () => undefined
}));

const mockedDashboard = vi.fn();
vi.mock('../../hooks/useDashboard', () => ({ useDashboard: () => mockedDashboard() }));

import PlanSection, { startingPoint } from './PlanSection';

const entry = (name: string, value: number, liquidity?: 'cash' | 'market' | 'locked') => ({
  assetClassId: name,
  name,
  color: '#000',
  value,
  gain: 0,
  percentage: 0,
  ...(liquidity ? { liquidity } : {})
});

const dashboard = {
  safety: { cash: 9039, market: 266492, locked: 246908, unsorted: 0, monthlySpending: 2317, cashMonths: 3.9, reachableMonths: 118 },
  allocation: [
    entry('Investments', 261928, 'market'),
    entry('Gold', 4564, 'market'),
    entry('Real estate', 150000, 'locked'),
    entry('Pension 3rd', 53748, 'locked'),
    entry('Pension 2nd', 43160, 'locked'),
    entry('Cash', 9039, 'cash')
  ],
  cashflow: {
    trailing: {
      income: 64658, consumption: 27806, months: 12,
      incomeBy: { salary: 61832, dividends: 981, interest: 104, other: 1741 }
    },
    previous: null,
    growth: null
  }
};

const field = (label: string) => screen.getByLabelText(label) as HTMLInputElement;

async function type(label: string, value: string) {
  const input = field(label);
  await userEvent.clear(input);
  if (value !== '') await userEvent.type(input, value);
}

beforeEach(() => {
  localStorage.clear();
  mockedDashboard.mockReturnValue({ data: dashboard, isLoading: false });
});

describe('startingPoint', () => {
  it('reads cash, funds and spending from the dashboard', () => {
    expect(startingPoint(dashboard as never)).toMatchObject({ cash: 9039, funds: 266492, spending: 2317 });
  });

  it('counts only locked classes called pensions as pensions, not the property', () => {
    expect(startingPoint(dashboard as never).pensions).toBe(96908);
  });

  it('takes salary as the take-home, not income from assets or refunds', () => {
    expect(startingPoint(dashboard as never).takeHome).toBe(5153);
  });

  it('falls back to total income when there is no breakdown', () => {
    const plain = { ...dashboard, cashflow: { ...dashboard.cashflow, trailing: { income: 36000, consumption: 12000, months: 12 } } };
    expect(startingPoint(plain as never).takeHome).toBe(3000);
  });

  it('is all zero before there is any data', () => {
    expect(startingPoint(undefined)).toEqual({ cash: 0, funds: 0, pensions: 0, spending: 0, takeHome: 0 });
  });
});

describe('the plan', () => {
  it('starts from the real figures, so there is nothing to type for a first answer', () => {
    render(<PlanSection />);

    expect(field('Cash').placeholder).toBe('9039');
    expect(field('Funds you could sell').placeholder).toBe('266492');
    expect(field('Pensions').placeholder).toBe('96908');
    expect(field('Spending a month').placeholder).toBe('2317');
    expect(field('Take-home a month now').placeholder).toBe('5153');
    expect(screen.getByText(/In 10 years, base case/)).toBeInTheDocument();
  });

  it('shows a spinner while the dashboard loads', () => {
    mockedDashboard.mockReturnValue({ data: undefined, isLoading: true });
    render(<PlanSection />);

    expect(screen.getByRole('progressbar')).toBeInTheDocument();
  });

  it('says there is nothing to start from when there is no data', () => {
    mockedDashboard.mockReturnValue({ data: undefined, isLoading: false });
    render(<PlanSection />);

    expect(screen.getByText(/Nothing to start from yet/)).toBeInTheDocument();
  });

  it('asks for the asset classes to be sorted when none have been', () => {
    mockedDashboard.mockReturnValue({
      data: { ...dashboard, safety: { ...dashboard.safety, cash: 0, market: 0 } },
      isLoading: false
    });
    render(<PlanSection />);

    expect(screen.getByText(/Mark your asset classes as cash, sellable or locked/)).toBeInTheDocument();
  });

  it('asks for the gap and the next income only once the income has an end', async () => {
    render(<PlanSection />);
    expect(screen.queryByLabelText('Months with no income')).not.toBeInTheDocument();

    await type('Income ends', '2027-08-31');

    expect(field('Months with no income').value).toBe('3');
    expect(field('Take-home a month after')).toBeInTheDocument();
  });

  it('describes what is saved once the next income starts', async () => {
    render(<PlanSection />);
    await type('Income ends', '2027-08-31');
    await type('Take-home a month after', '3000');

    // 3000 take-home less 2317 spending
    expect(await screen.findByText(/Once the next income starts, you put aside about 683 € a month/)).toBeInTheDocument();
  });

  it('says so when the next income would not cover spending', async () => {
    render(<PlanSection />);
    await type('Income ends', '2027-08-31');
    await type('Take-home a month after', '2000');

    expect(await screen.findByText(/you would draw about 317 € a month from your savings/)).toBeInTheDocument();
  });

  it('warns when the money runs out in the base case', async () => {
    render(<PlanSection />);
    await type('Cash', '0');
    await type('Funds you could sell', '1000');
    await type('Take-home a month now', '500');

    expect(await screen.findByText(/runs out after/)).toBeInTheDocument();
  });

  it('works out the independence target from spending and the rate it is lived on', async () => {
    render(<PlanSection />);

    // 2317 * 12 = 27804 over 3.5%
    expect(screen.getByText(/Sets the independence target: 794 400 €/)).toBeInTheDocument();
    await type('Lived on each year, % of funds', '4');
    expect(screen.getByText(/Sets the independence target: 695 100 €/)).toBeInTheDocument();
  });

  it('shows the range and the chances once the random paths are in', async () => {
    render(<PlanSection />);

    expect(await screen.findByText('Likely range at the end')).toBeInTheDocument();
    expect(screen.getByText('Chance of reaching it')).toBeInTheDocument();
    expect(screen.getByText('Chance of running out')).toBeInTheDocument();
  });

  it('lists the same plan at other take-home levels, the current one marked', async () => {
    render(<PlanSection />);
    await type('Income ends', '2027-08-31');
    await type('Take-home a month after', '3000');

    const table = await screen.findByRole('table', { name: 'What if the income were different' });
    await waitFor(() => expect(within(table).getAllByRole('row').length).toBeGreaterThan(4));
    const rows = within(table).getAllByRole('row');
    expect(rows.some((r) => /3\s?000\s€/.test(r.textContent ?? ''))).toBe(true);
  });

  it('shows the year by year table on request', async () => {
    render(<PlanSection />);
    expect(screen.queryByRole('table', { name: /Year by year/ })).not.toBeInTheDocument();

    await userEvent.click(screen.getByRole('button', { name: 'Show year by year' }));

    expect(await screen.findByRole('table', { name: /Year by year/ })).toBeInTheDocument();
  });

  it('remembers what was typed between visits', async () => {
    const { unmount } = render(<PlanSection />);
    await type('Income ends', '2027-08-31');
    unmount();

    render(<PlanSection />);

    expect(field('Income ends').value).toBe('2027-08-31');
  });

  it('goes back to following the data when reset', async () => {
    render(<PlanSection />);
    await type('Cash', '123');
    await type('Income ends', '2027-08-31');

    await userEvent.click(screen.getByRole('button', { name: 'Reset to my data' }));

    expect(field('Cash').value).toBe('');
    expect(field('Income ends').value).toBe('');
    expect(screen.queryByLabelText('Months with no income')).not.toBeInTheDocument();
  });
});
