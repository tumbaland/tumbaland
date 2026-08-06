import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TransactionFilters, { EMPTY_FILTERS, toQuery, hasAnyFilter, FilterValues } from './TransactionFilters';

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
