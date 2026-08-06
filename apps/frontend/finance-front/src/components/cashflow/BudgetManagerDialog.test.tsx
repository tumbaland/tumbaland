import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

const mockedCreate = vi.fn();
const mockedUpdate = vi.fn();
const mockedDelete = vi.fn();

vi.mock('../../hooks/useCashflow', () => ({
  useCreateBudget: () => ({ mutateAsync: mockedCreate, isPending: false }),
  useUpdateBudget: () => ({ mutateAsync: mockedUpdate }),
  useDeleteBudget: () => ({ mutateAsync: mockedDelete })
}));

import BudgetManagerDialog from './BudgetManagerDialog';
import { Budget } from '../../services/cashflowService';

const budgets: Budget[] = [
  { _id: 'b1', category: 'Rent', amount: 800 },
  { _id: 'b2', category: 'Groceries', amount: 400 }
];

const renderDialog = (props: Partial<React.ComponentProps<typeof BudgetManagerDialog>> = {}) => {
  const notify = vi.fn();
  render(
    <BudgetManagerDialog
      open
      onClose={vi.fn()}
      budgets={budgets}
      categories={['Rent', 'Groceries', 'Travel']}
      notify={notify}
      {...props}
    />
  );
  return { notify };
};

beforeEach(() => vi.clearAllMocks());

it('lists existing budgets with their monthly amount', () => {
  renderDialog();

  expect(screen.getByText('Rent')).toBeInTheDocument();
  expect(screen.getByDisplayValue('800')).toBeInTheDocument();
});

it('explains itself when nothing is budgeted yet', () => {
  renderDialog({ budgets: [] });

  expect(screen.getByText(/No budgets yet/)).toBeInTheDocument();
});

it('adds a budget for a new category', async () => {
  mockedCreate.mockResolvedValue({});
  const { notify } = renderDialog({ tenantGroupId: 'g1' });

  await userEvent.type(screen.getByLabelText('Category'), 'Travel');
  await userEvent.type(screen.getByLabelText(/per month/i), '200');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() =>
    expect(mockedCreate).toHaveBeenCalledWith({ category: 'Travel', amount: 200, groupId: 'g1' })
  );
  expect(notify).toHaveBeenCalledWith('Budget set for Travel', 'success');
});

it('rejects an add with no category or amount', async () => {
  const { notify } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(notify).toHaveBeenCalledWith('Pick a category and a monthly amount', 'error');
  expect(mockedCreate).not.toHaveBeenCalled();
});

it('reports a duplicate category rejection from the server', async () => {
  mockedCreate.mockRejectedValue(new Error('conflict'));
  const { notify } = renderDialog();

  await userEvent.type(screen.getByLabelText('Category'), 'Rent');
  await userEvent.type(screen.getByLabelText(/per month/i), '900');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() =>
    expect(notify).toHaveBeenCalledWith(expect.stringContaining('already exist'), 'error')
  );
});

it('saves an edited amount on blur', async () => {
  mockedUpdate.mockResolvedValue({});
  renderDialog();

  const field = screen.getByDisplayValue('800');
  await userEvent.clear(field);
  await userEvent.type(field, '850');
  await userEvent.tab();

  await waitFor(() => expect(mockedUpdate).toHaveBeenCalledWith({ id: 'b1', data: { amount: 850 } }));
});

it('does not save when the amount is unchanged', async () => {
  renderDialog();

  await userEvent.click(screen.getByDisplayValue('800'));
  await userEvent.tab();

  expect(mockedUpdate).not.toHaveBeenCalled();
});

it('ignores an unparseable amount rather than writing NaN', async () => {
  renderDialog();

  const field = screen.getByDisplayValue('800');
  await userEvent.clear(field);
  await userEvent.type(field, 'lots');
  await userEvent.tab();

  expect(mockedUpdate).not.toHaveBeenCalled();
});

it('reports a failed amount update', async () => {
  mockedUpdate.mockRejectedValue(new Error('nope'));
  const { notify } = renderDialog();

  const field = screen.getByDisplayValue('800');
  await userEvent.clear(field);
  await userEvent.type(field, '850');
  await userEvent.tab();

  await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to update the budget', 'error'));
});

it('removes a budget after confirming', async () => {
  mockedDelete.mockResolvedValue({});
  const { notify } = renderDialog();

  const deleteButtons = screen
    .getAllByRole('button')
    .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

  await waitFor(() => expect(mockedDelete).toHaveBeenCalledWith('b1'));
  expect(notify).toHaveBeenCalledWith('Budget removed', 'success');
});

it('reports a failed removal', async () => {
  mockedDelete.mockRejectedValue(new Error('nope'));
  const { notify } = renderDialog();

  const deleteButtons = screen
    .getAllByRole('button')
    .filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[0]);
  await userEvent.click(screen.getByRole('button', { name: 'Remove' }));

  await waitFor(() => expect(notify).toHaveBeenCalledWith('Failed to remove the budget', 'error'));
});
