import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedUpdate = vi.fn();
const mockedBulk = vi.fn();

vi.mock('../../hooks/useCashflow', () => ({
  useUpdateCategory: () => ({ mutateAsync: mockedUpdate, isPending: false }),
  useRecategorise: () => ({ mutateAsync: mockedBulk, isPending: false })
}));

import CategoryEditDialog, { counterpartyOf } from './CategoryEditDialog';
import { Transaction } from '../../services/cashflowService';

const transaction: Transaction = {
  _id: 'x1',
  date: '2026-07-06',
  amount: 15.59,
  type: 'expense',
  category: 'Uncategorised',
  note: 'RIMI · 30/12 19:27 kaart...156408 RIMI/JUHKENTALI'
};

const renderDialog = (props = {}) => {
  const notify = vi.fn();
  const onClose = vi.fn();
  render(
    <CategoryEditDialog
      open
      onClose={onClose}
      transaction={transaction}
      categories={['Groceries', 'Transport']}
      notify={notify}
      {...props}
    />
  );
  return { notify, onClose };
};

const typeCategory = async (value: string) => {
  const input = screen.getByLabelText('Category');
  await userEvent.clear(input);
  await userEvent.type(input, value);
};

beforeEach(() => vi.clearAllMocks());

describe('counterpartyOf', () => {
  it('takes the merchant, not the bank free text after it', () => {
    expect(counterpartyOf('RIMI · 30/12 kaart...156408')).toBe('RIMI');
  });

  it('handles a note with no separator', () => {
    expect(counterpartyOf('Binance')).toBe('Binance');
  });

  it('handles a missing note', () => {
    expect(counterpartyOf(undefined)).toBe('');
  });
});

it('shows what is being recategorised', () => {
  renderDialog();

  expect(screen.getByText('RIMI')).toBeInTheDocument();
  expect(screen.getByText(/currently Uncategorised/)).toBeInTheDocument();
});

it('changes one transaction by default', async () => {
  mockedUpdate.mockResolvedValue({});
  const { notify, onClose } = renderDialog();

  await typeCategory('Groceries');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith({ id: 'x1', category: 'Groceries' }));
  expect(mockedBulk).not.toHaveBeenCalled();
  expect(notify).toHaveBeenCalledWith('Moved to Groceries', 'success');
  expect(onClose).toHaveBeenCalled();
});

it('applies to every row from the same merchant when asked', async () => {
  mockedBulk.mockResolvedValue({ updated: 583 });
  const { notify } = renderDialog({ tenantGroupId: 'g1' });

  await typeCategory('Groceries');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() =>
    expect(mockedBulk).toHaveBeenCalledWith({
      fromCategory: 'Uncategorised',
      toCategory: 'Groceries',
      search: 'RIMI',
      groupId: 'g1'
    })
  );
  expect(notify).toHaveBeenCalledWith('Moved 583 transactions to Groceries', 'success');
});

it('says a bulk change cannot reach rows already sorted', async () => {
  renderDialog();

  await userEvent.click(screen.getByRole('checkbox'));

  expect(screen.getByText(/Only rows currently in Uncategorised are touched/)).toBeInTheDocument();
});

it('uses the singular for a single match', async () => {
  mockedBulk.mockResolvedValue({ updated: 1 });
  const { notify } = renderDialog();

  await typeCategory('Groceries');
  await userEvent.click(screen.getByRole('checkbox'));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('Moved 1 transaction to Groceries', 'success'));
});

it('refuses an empty category', async () => {
  renderDialog();

  await userEvent.clear(screen.getByLabelText('Category'));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Pick or type a category');
  expect(mockedUpdate).not.toHaveBeenCalled();
});

it('keeps a category typed for the first time', async () => {
  mockedUpdate.mockResolvedValue({});
  renderDialog();

  await typeCategory('Bicycle');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith({ id: 'x1', category: 'Bicycle' }));
});

it('offers the categories already in use', async () => {
  renderDialog();

  // The field opens pre-filled with the current category, which filters the
  // list down; typing a prefix of a real one brings it back.
  const input = screen.getByLabelText('Category');
  await userEvent.clear(input);
  await userEvent.type(input, 'Trans');

  expect(await screen.findByRole('option', { name: 'Transport' })).toBeInTheDocument();
});

it('surfaces a failure and stays open', async () => {
  mockedUpdate.mockRejectedValue(new Error('nope'));
  const { onClose } = renderDialog();

  await typeCategory('Groceries');
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to update the category'));
  expect(onClose).not.toHaveBeenCalled();
});

it('offers no bulk option when there is no counterparty to match on', () => {
  renderDialog({ transaction: { ...transaction, note: undefined } });

  expect(screen.queryByRole('checkbox')).not.toBeInTheDocument();
});
