import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import TransactionFilters, {
  EMPTY_FILTERS,
  toQuery,
  hasAnyFilter,
  periodPresets,
  FilterValues
} from './TransactionFilters';

const totals = { count: 7030, income: 340828, expense: 150169, net: 190659 };

const renderBar = (filters: Partial<FilterValues> = {}, props = {}) => {
  const onChange = vi.fn();
  render(
    <TransactionFilters
      filters={{ ...EMPTY_FILTERS, ...filters }}
      onChange={onChange}
      categories={['Groceries', 'Rent']}
      totals={totals}
      {...props}
    />
  );
  return { onChange };
};

describe('toQuery', () => {
  it('sends nothing for an untouched bar', () => {
    expect(toQuery(EMPTY_FILTERS)).toEqual({});
  });

  it('includes only the fields that are set', () => {
    expect(toQuery({ ...EMPTY_FILTERS, category: 'Rent', search: '  rimi  ' })).toEqual({
      category: 'Rent',
      search: 'rimi'
    });
  });

  it('drops whitespace-only search rather than querying for it', () => {
    expect(toQuery({ ...EMPTY_FILTERS, search: '   ' })).toEqual({});
  });
});

describe('hasAnyFilter', () => {
  it('is false for an untouched bar', () => {
    expect(hasAnyFilter(EMPTY_FILTERS)).toBe(false);
  });

  it('is true once anything is set', () => {
    expect(hasAnyFilter({ ...EMPTY_FILTERS, type: 'income' })).toBe(true);
  });
});

it('reports totals over the whole filtered set', () => {
  renderBar();

  expect(screen.getByText('7,030 matching')).toBeInTheDocument();
  expect(screen.getByText(/In 340 828/)).toBeInTheDocument();
  expect(screen.getByText(/Out 150 169/)).toBeInTheDocument();
  expect(screen.getByText(/Net 190 659/)).toBeInTheDocument();
});

it('passes a typed search up', async () => {
  const { onChange } = renderBar();

  await userEvent.type(screen.getByLabelText('Search'), 'r');

  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ search: 'r' }));
});

it('passes a chosen category up', async () => {
  const { onChange } = renderBar();

  await userEvent.click(screen.getByLabelText('Category'));
  await userEvent.click(screen.getByRole('option', { name: 'Rent' }));

  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'Rent' }));
});

it('passes a chosen type up', async () => {
  const { onChange } = renderBar();

  await userEvent.click(screen.getByLabelText('Type'));
  await userEvent.click(screen.getByRole('option', { name: 'Income' }));

  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ type: 'income' }));
});

it('offers a clear only once something is set', () => {
  renderBar();
  expect(screen.queryByRole('button', { name: /clear filters/i })).not.toBeInTheDocument();
});

it('clears everything at once', async () => {
  const { onChange } = renderBar({ search: 'rimi', category: 'Rent' });

  await userEvent.click(screen.getByRole('button', { name: /clear filters/i }));

  expect(onChange).toHaveBeenCalledWith(EMPTY_FILTERS);
});

it('renders without totals before the first response', () => {
  renderBar({}, { totals: undefined });

  expect(screen.queryByText(/matching/)).not.toBeInTheDocument();
  expect(screen.getByLabelText('Search')).toBeInTheDocument();
});

it('passes a date range up', async () => {
  const { onChange } = renderBar();

  await userEvent.type(screen.getByLabelText('From'), '2026-01-01');
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: '2026-01-01' }));

  await userEvent.type(screen.getByLabelText('To'), '2026-06-30');
  expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ to: '2026-06-30' }));
});

it('carries a date range into the query', () => {
  expect(toQuery({ ...EMPTY_FILTERS, from: '2026-01-01', to: '2026-06-30' })).toEqual({
    from: '2026-01-01',
    to: '2026-06-30'
  });
});

it('formats the totals in the given currency', () => {
  renderBar({}, { currency: 'USD' });

  expect(screen.getByText(/In 340 828 \$/)).toBeInTheDocument();
});

describe('period presets', () => {
  const YEARS = [2023, 2024, 2025, 2026];

  it('offers a chip per year, newest first', () => {
    // Reaching January 2023 through a month grid is dozens of clicks
    renderBar({}, { years: YEARS });

    const chips = screen.getAllByRole('button').map((b) => b.textContent);
    expect(chips).toEqual(expect.arrayContaining(['2026', '2025', '2024', '2023']));
    expect(chips.indexOf('2026')).toBeLessThan(chips.indexOf('2023'));
  });

  it('sets a whole year in one click', async () => {
    const { onChange } = renderBar({}, { years: YEARS });

    await userEvent.click(screen.getByRole('button', { name: '2024' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: '2024-01-01', to: '2024-12-31' }));
  });

  it('clears the period when the active chip is clicked again', async () => {
    const { onChange } = renderBar({ from: '2024-01-01', to: '2024-12-31' }, { years: YEARS });

    await userEvent.click(screen.getByRole('button', { name: '2024' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ from: '', to: '' }));
  });

  it('leaves the other filters alone when a period is picked', async () => {
    const { onChange } = renderBar({ category: 'Groceries' }, { years: YEARS });

    await userEvent.click(screen.getByRole('button', { name: '2024' }));

    expect(onChange).toHaveBeenCalledWith(expect.objectContaining({ category: 'Groceries' }));
  });

  it('offers no year chips before there is any history', () => {
    // The relative ranges still make sense; a year with nothing in it does not
    renderBar({}, { years: [] });

    expect(screen.getByRole('button', { name: 'This month' })).toBeInTheDocument();
    expect(screen.queryByRole('button', { name: /^20\d\d$/ })).not.toBeInTheDocument();
  });

  it('stops the from field wandering earlier than the data goes', () => {
    renderBar({}, { years: YEARS });

    expect(screen.getByLabelText('From')).toHaveAttribute('min', '2023-01-01');
  });

  it('will not let the range be picked backwards', () => {
    renderBar({ from: '2024-06-01' }, { years: YEARS });

    expect(screen.getByLabelText('To')).toHaveAttribute('min', '2024-06-01');
  });
});

describe('periodPresets', () => {
  const today = new Date('2026-08-07T00:00:00Z');

  it('ends a year in progress today rather than in December', () => {
    // A range running to 2026-12-31 reads back as months of empty tail
    const presets = periodPresets([2026], today);

    expect(presets.find((p) => p.label === '2026')).toEqual({
      label: '2026',
      from: '2026-01-01',
      to: '2026-08-07'
    });
  });

  it('runs a finished year to its end', () => {
    expect(periodPresets([2024], today).find((p) => p.label === '2024')?.to).toBe('2024-12-31');
  });

  it('starts this month on the first', () => {
    expect(periodPresets([], today)[0]).toEqual({
      label: 'This month',
      from: '2026-08-01',
      to: '2026-08-07'
    });
  });

  it('counts twelve months back from today, not from January', () => {
    expect(periodPresets([], today)[1]).toEqual({
      label: 'Last 12 months',
      from: '2025-08-07',
      to: '2026-08-07'
    });
  });
});
