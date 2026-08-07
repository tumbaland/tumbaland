import { render, screen } from '@testing-library/react';
import CashflowSummaryCards from './CashflowSummaryCards';
import { CashflowSummary, Analytics, PeriodTotals } from '../../services/cashflowService';

const totals = (over: Partial<PeriodTotals> = {}): PeriodTotals => ({
  income: 4000,
  expense: 2500,
  consumption: 2500,
  invested: 0,
  divested: 0,
  savings: 1500,
  savingsRate: 37.5,
  months: 12,
  from: '2025-09',
  to: '2026-08',
  ...over
});

const analytics = (over: Partial<Analytics> = {}): Analytics =>
  ({
    years: [],
    months: [],
    trailing: {
      current: totals(),
      previous: totals({ income: 3000, consumption: 2000, expense: 2000, savings: 1000, from: '2024-09', to: '2025-08' })
    },
    categoryTrends: [
      { category: 'Rent', byYear: {}, total: 10800, latest: 10800, previous: 9000, change: 1800, changePct: 20, perMonth: 900 },
      { category: 'Groceries', byYear: {}, total: 3600, latest: 3600, previous: 3600, change: 0, changePct: 0, perMonth: 300 }
    ],
    incomeSources: [],
    investmentCategories: ['Investments', 'Savings'],
    currency: 'EUR',
    ...over
  }) as Analytics;

const base: CashflowSummary = {
  months: [{ month: '2026-07', income: 4000, expense: 2500, savings: 1500, savingsRate: 37.5 }],
  categories: [{ category: 'Rent', spent: 900 }],
  totals: { month: 'all', income: 4000, expense: 2500, savings: 1500, savingsRate: 37.5 },
  growth: {
    from: '2026-07',
    to: '2026-08',
    months: 1,
    netWorthChange: 2000,
    contributions: 1500,
    marketGrowth: 500,
    complete: true
  },
  growthTrailing: {
    from: '2025-08',
    to: '2026-08',
    months: 12,
    netWorthChange: 24_000,
    contributions: 18_000,
    marketGrowth: 6000,
    complete: true
  }
};

const renderCards = (summary = base, over: Partial<Analytics> = {}) =>
  render(<CashflowSummaryCards summary={summary} analytics={analytics(over)} />);

describe('range labelling', () => {
  it('says which period every figure covers', () => {
    renderCards();

    expect(screen.getByText('12-month summary')).toBeInTheDocument();
    expect(screen.getByText(/Sept 2025 – Aug 2026/)).toBeInTheDocument();
  });

  it('says what the change is measured against', () => {
    renderCards();

    expect(screen.getByText(/change is against the 12 months before/)).toBeInTheDocument();
  });
});

describe('headline figures', () => {
  it('shows income, spending, kept and the rate', () => {
    renderCards();

    expect(screen.getByText('4000 €')).toBeInTheDocument();
    expect(screen.getByText('2500 €')).toBeInTheDocument();
    expect(screen.getByText('1500 €')).toBeInTheDocument();
    expect(screen.getByText('+37.5%')).toBeInTheDocument();
  });

  it('titles every card by what it measures, in the same shape', () => {
    renderCards();

    expect(screen.getByText('Total income')).toBeInTheDocument();
    expect(screen.getByText('Total spending')).toBeInTheDocument();
    expect(screen.getByText('Cash kept')).toBeInTheDocument();
    expect(screen.getByText('Savings rate')).toBeInTheDocument();
  });

  it('spells out what the two derived figures mean', () => {
    renderCards();

    expect(screen.getByText('Income minus spending')).toBeInTheDocument();
    expect(screen.getByText('Share of income kept')).toBeInTheDocument();
  });

  it('compares each against the previous window', () => {
    renderCards();

    expect(screen.getByText('+33.3%')).toBeInTheDocument();  // income 3000 → 4000
    expect(screen.getByText('+25.0%')).toBeInTheDocument();  // spending 2000 → 2500
    expect(screen.getByText('+50.0%')).toBeInTheDocument();  // kept 1000 → 1500
  });

  it('separates investing from spending', () => {
    renderCards(base, {
      trailing: { current: totals({ consumption: 2000, invested: 500 }), previous: null }
    });

    expect(screen.getByText('500 € invested')).toBeInTheDocument();
  });

  it('shows a dash for a savings rate with no income behind it', () => {
    renderCards(base, {
      trailing: { current: totals({ income: 0, savingsRate: null }), previous: null }
    });

    expect(screen.getByText('—')).toBeInTheDocument();
    expect(screen.getByText('No income recorded')).toBeInTheDocument();
  });
});

describe('net-worth split', () => {
  it('opens on the same twelve months as the figures above it', () => {
    renderCards();

    expect(screen.getByText('Net worth movement')).toBeInTheDocument();
    expect(screen.getByText('Aug 2025 → Aug 2026 · 12 months')).toBeInTheDocument();
  });

  it('shows nothing at all when there is no pair to compare', () => {
    renderCards({ ...base, growth: null, growthTrailing: null });

    expect(screen.queryByText('Net worth movement')).not.toBeInTheDocument();
  });
});

describe('spending by category', () => {
  it('reports a monthly average over the last twelve months, not a lifetime one', () => {
    renderCards();

    expect(screen.getByText('Average per month over the last 12 months')).toBeInTheDocument();
    expect(screen.getByText('900 € / month')).toBeInTheDocument();
    expect(screen.getByText('300 € / month')).toBeInTheDocument();
  });

  it('keeps investing out of the category list', () => {
    renderCards(base, {
      categoryTrends: [
        { category: 'Rent', byYear: {}, total: 1, latest: 1, previous: 0, change: 1, changePct: null, perMonth: 900 },
        { category: 'Investments', byYear: {}, total: 1, latest: 1, previous: 0, change: 1, changePct: null, perMonth: 2000 }
      ]
    });

    expect(screen.getByText('Rent')).toBeInTheDocument();
    expect(screen.queryByText('Investments')).not.toBeInTheDocument();
  });

  it('omits the section when nothing has been categorised', () => {
    renderCards(base, { categoryTrends: [] });

    expect(screen.queryByText('Spending by category')).not.toBeInTheDocument();
  });
});
