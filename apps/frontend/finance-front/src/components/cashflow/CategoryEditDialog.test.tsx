import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';

const mockedUpdate = vi.fn();
const mockedBulk = vi.fn();
const mockedCreateRule = vi.fn();

vi.mock('../../hooks/useCashflow', () => ({
  useUpdateCategory: () => ({ mutateAsync: mockedUpdate, isPending: false }),
  useRecategorise: () => ({ mutateAsync: mockedBulk, isPending: false })
}));

vi.mock('../../hooks/useCategoryRules', () => ({
  useCreateCategoryRule: () => ({ mutateAsync: mockedCreateRule, isPending: false })
}));

const rememberBox = () => screen.getByLabelText('Remember this for future imports');
const applyToAllBox = () => screen.getByLabelText('Apply to existing rows from this merchant');

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

beforeEach(() => {
  vi.clearAllMocks();
  mockedCreateRule.mockResolvedValue({});
});

describe('counterpartyOf', () => {
  it('takes the merchant, not the bank free text after it', () => {
    expect(counterpartyOf('RIMI · 30/12 kaart...156408')).toBe('RIMI');
  });

  it('handles a note with no separator', () => {
    expect(counterpartyOf('VELOMARKET')).toBe('VELOMARKET');
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
  await userEvent.click(rememberBox());
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
  await userEvent.click(rememberBox());
  await userEvent.click(applyToAllBox());
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

  await userEvent.click(applyToAllBox());

  expect(screen.getByText(/Only rows currently in Uncategorised are touched/)).toBeInTheDocument();
});

it('uses the singular for a single match', async () => {
  mockedBulk.mockResolvedValue({ updated: 1 });
  const { notify } = renderDialog();

  await typeCategory('Groceries');
  await userEvent.click(rememberBox());
  await userEvent.click(applyToAllBox());
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
  await userEvent.click(rememberBox());
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

describe('remembering the correction', () => {
  it('writes a rule by default, so the next import files it the same way', async () => {
    mockedUpdate.mockResolvedValue({});
    const { notify } = renderDialog({ tenantGroupId: 'g1' });

    await typeCategory('Groceries');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(mockedCreateRule).toHaveBeenCalledWith({
        pattern: 'RIMI',
        category: 'Groceries',
        groupId: 'g1'
      })
    );
    expect(notify).toHaveBeenCalledWith('RIMI will be filed as Groceries from now on', 'success');
  });

  it('matches on the merchant, not on the terminal id unique to one payment', async () => {
    mockedUpdate.mockResolvedValue({});
    renderDialog();

    await typeCategory('Groceries');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedCreateRule).toHaveBeenCalledWith(expect.objectContaining({ pattern: 'RIMI' })));
  });

  it('writes no rule when the box is cleared', async () => {
    mockedUpdate.mockResolvedValue({});
    renderDialog();

    await typeCategory('Groceries');
    await userEvent.click(rememberBox());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedUpdate).toHaveBeenCalled());
    expect(mockedCreateRule).not.toHaveBeenCalled();
  });

  it('writes a rule alongside a bulk move', async () => {
    mockedBulk.mockResolvedValue({ updated: 12 });
    renderDialog();

    await typeCategory('Groceries');
    await userEvent.click(applyToAllBox());
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(mockedCreateRule).toHaveBeenCalled());
    expect(mockedBulk).toHaveBeenCalled();
  });

  it('says the category changed even when the rule could not be saved', async () => {
    mockedUpdate.mockResolvedValue({});
    mockedCreateRule.mockRejectedValue(new Error('nope'));
    const { notify, onClose } = renderDialog();

    await typeCategory('Groceries');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() =>
      expect(notify).toHaveBeenCalledWith('Category changed, but the rule for RIMI could not be saved', 'error')
    );
    // The move did happen, so the dialog has nothing left to offer
    expect(onClose).toHaveBeenCalled();
  });

  it('writes no rule when the category change itself failed', async () => {
    mockedUpdate.mockRejectedValue(new Error('nope'));
    renderDialog();

    await typeCategory('Groceries');
    await userEvent.click(screen.getByRole('button', { name: 'Save' }));

    await waitFor(() => expect(screen.getByRole('alert')).toBeInTheDocument());
    expect(mockedCreateRule).not.toHaveBeenCalled();
  });

  it('shows the category it is about to remember as you type it', async () => {
    renderDialog();

    await typeCategory('Bicycle');

    expect(screen.getByText(/file RIMI as/)).toBeInTheDocument();
    expect(screen.getByText('Bicycle')).toBeInTheDocument();
  });
});
