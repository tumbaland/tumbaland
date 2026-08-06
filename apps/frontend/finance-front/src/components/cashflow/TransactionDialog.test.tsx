import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import TransactionDialog from './TransactionDialog';
import { Transaction } from '../../services/cashflowService';

const existing: Transaction = {
  _id: 'x1',
  date: '2026-07-06T00:00:00.000Z',
  amount: 900,
  type: 'expense',
  category: 'Rent',
  note: 'July'
};

const renderDialog = (props: Partial<React.ComponentProps<typeof TransactionDialog>> = {}) => {
  const onSubmit = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(
    <TransactionDialog
      open
      onClose={onClose}
      onSubmit={onSubmit}
      categories={['Rent', 'Salary']}
      saving={false}
      {...props}
    />
  );
  return { onSubmit, onClose };
};

beforeEach(() => vi.clearAllMocks());

it('opens blank when adding', () => {
  renderDialog();

  expect(screen.getByText('Add transaction')).toBeInTheDocument();
  expect(screen.getByLabelText(/amount/i)).toHaveValue('');
});

it('pre-fills every field when editing', () => {
  renderDialog({ transaction: existing });

  expect(screen.getByText('Edit transaction')).toBeInTheDocument();
  expect(screen.getByLabelText(/amount/i)).toHaveValue('900');
  expect(screen.getByLabelText(/^Category/)).toHaveValue('Rent');
  expect(screen.getByLabelText(/note/i)).toHaveValue('July');
});

it('defaults to expense and switches to income', async () => {
  const { onSubmit } = renderDialog();

  await userEvent.click(screen.getByRole('button', { name: 'Income' }));
  await userEvent.type(screen.getByLabelText(/amount/i), '3000');
  await userEvent.type(screen.getByLabelText(/^Category/), 'Salary');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() =>
    expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ type: 'income', amount: 3000 }))
  );
});

it('keeps a category typed for the first time', async () => {
  const { onSubmit } = renderDialog();

  await userEvent.type(screen.getByLabelText(/amount/i), '120');
  await userEvent.type(screen.getByLabelText(/^Category/), 'Bicycle');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ category: 'Bicycle' })));
});

it('carries the group id when tenant-scoped', async () => {
  const { onSubmit } = renderDialog({ tenantGroupId: 'g1' });

  await userEvent.type(screen.getByLabelText(/amount/i), '50');
  await userEvent.type(screen.getByLabelText(/^Category/), 'Rent');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ groupId: 'g1' })));
});

it('rejects a missing or non-positive amount', async () => {
  const { onSubmit } = renderDialog();

  await userEvent.type(screen.getByLabelText(/^Category/), 'Rent');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Enter an amount greater than zero');
  expect(onSubmit).not.toHaveBeenCalled();
});

it('rejects a missing category', async () => {
  const { onSubmit } = renderDialog();

  await userEvent.type(screen.getByLabelText(/amount/i), '40');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  expect(screen.getByRole('alert')).toHaveTextContent('Pick or type a category');
  expect(onSubmit).not.toHaveBeenCalled();
});

it('omits an empty note rather than sending a blank string', async () => {
  const { onSubmit } = renderDialog();

  await userEvent.type(screen.getByLabelText(/amount/i), '40');
  await userEvent.type(screen.getByLabelText(/^Category/), 'Rent');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(onSubmit).toHaveBeenCalledWith(expect.objectContaining({ note: undefined })));
});

it('closes after a successful save', async () => {
  const { onClose } = renderDialog();

  await userEvent.type(screen.getByLabelText(/amount/i), '40');
  await userEvent.type(screen.getByLabelText(/^Category/), 'Rent');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(onClose).toHaveBeenCalled());
});

it('surfaces a save failure and stays open', async () => {
  const onSubmit = vi.fn().mockRejectedValue(new Error('nope'));
  const onClose = vi.fn();
  render(
    <TransactionDialog
      open
      onClose={onClose}
      onSubmit={onSubmit}
      categories={[]}
      saving={false}
    />
  );

  await userEvent.type(screen.getByLabelText(/amount/i), '40');
  await userEvent.type(screen.getByLabelText(/^Category/), 'Rent');
  await userEvent.click(screen.getByRole('button', { name: 'Add' }));

  await waitFor(() => expect(screen.getByRole('alert')).toHaveTextContent('Failed to save the transaction'));
  expect(onClose).not.toHaveBeenCalled();
});

it('disables the submit button while saving', () => {
  renderDialog({ saving: true });

  expect(screen.getByRole('button', { name: 'Add' })).toBeDisabled();
});

it('offers the existing categories as options', async () => {
  renderDialog();

  await userEvent.click(screen.getByLabelText(/^Category/));

  expect(screen.getByRole('option', { name: 'Rent' })).toBeInTheDocument();
  expect(screen.getByRole('option', { name: 'Salary' })).toBeInTheDocument();
});
