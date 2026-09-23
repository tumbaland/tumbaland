import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import type { ComponentProps } from 'react';
import type AssetClassModal from '../AssetClassModal';

const mockedCreateMutateAsync = vi.fn();
const mockedUpdateMutateAsync = vi.fn();
const mockedDeleteMutateAsync = vi.fn();

vi.mock('../../hooks/useAssetClasses', () => ({
  useCreateAssetClass: () => ({ mutateAsync: mockedCreateMutateAsync }),
  useUpdateAssetClass: () => ({ mutateAsync: mockedUpdateMutateAsync }),
  useDeleteAssetClass: () => ({ mutateAsync: mockedDeleteMutateAsync })
}));

vi.mock('../AssetClassModal', () => ({
  default: ({ open, onSubmit, form, title }: ComponentProps<typeof AssetClassModal>) =>
    open ? (
      <div>
        <div>{title}</div>
        <button onClick={() => onSubmit(form)}>submit modal</button>
      </div>
    ) : null
}));

import AssetClassManagerDialog from './AssetClassManagerDialog';
import { AssetClass } from '../../types';

const assetClasses: AssetClass[] = [
  { _id: 'a1', name: 'Stocks', description: 'Equities', color: '#111111', userId: 'u1', createdAt: '', updatedAt: '' },
  { _id: 'a2', name: 'Cash', userId: 'u1', createdAt: '', updatedAt: '' }
];

beforeEach(() => vi.clearAllMocks());

it('shows an empty state when there are no asset classes', () => {
  render(<AssetClassManagerDialog open onClose={vi.fn()} assetClasses={[]} isClassInUse={() => false} />);
  expect(screen.getByText(/no asset classes yet/i)).toBeInTheDocument();
});

it('lists asset classes and disables delete for classes in use', () => {
  render(
    <AssetClassManagerDialog
      open
      onClose={vi.fn()}
      assetClasses={assetClasses}
      isClassInUse={(id) => id === 'a1'}
    />
  );

  expect(screen.getByText('Stocks')).toBeInTheDocument();
  expect(screen.getByText('Cash')).toBeInTheDocument();

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  expect(deleteButtons[0]).toBeDisabled(); // Stocks is in use
  expect(deleteButtons[1]).toBeEnabled(); // Cash is not
});

it('opens the create-class editor with the tenant group id and creates on submit', async () => {
  mockedCreateMutateAsync.mockResolvedValue({});
  render(
    <AssetClassManagerDialog open onClose={vi.fn()} assetClasses={[]} tenantGroupId="g1" isClassInUse={() => false} />
  );

  await userEvent.click(screen.getByRole('button', { name: /add class/i }));
  expect(screen.getByText('Add Asset Class')).toBeInTheDocument();

  await userEvent.click(screen.getByText('submit modal'));

  expect(mockedCreateMutateAsync).toHaveBeenCalledWith(
    expect.objectContaining({ name: '', color: '#3b82f6', groupId: 'g1' })
  );
});

it('opens the edit editor pre-filled and updates on submit', async () => {
  mockedUpdateMutateAsync.mockResolvedValue({});
  render(<AssetClassManagerDialog open onClose={vi.fn()} assetClasses={assetClasses} isClassInUse={() => false} />);

  const editButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="EditIcon"]'));
  await userEvent.click(editButtons[0]);

  expect(screen.getByText('Edit Asset Class')).toBeInTheDocument();
  await userEvent.click(screen.getByText('submit modal'));

  expect(mockedUpdateMutateAsync).toHaveBeenCalledWith({
    id: 'a1',
    data: { name: 'Stocks', description: 'Equities', color: '#111111', kind: 'asset' }
  });
});

it('deletes an asset class after confirming', async () => {
  mockedDeleteMutateAsync.mockResolvedValue({});
  render(<AssetClassManagerDialog open onClose={vi.fn()} assetClasses={assetClasses} isClassInUse={() => false} />);

  const deleteButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="DeleteIcon"]'));
  await userEvent.click(deleteButtons[1]); // Cash, not in use

  expect(await screen.findByText('Delete asset class')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: 'Delete' }));

  expect(mockedDeleteMutateAsync).toHaveBeenCalledWith('a2');
});

it('calls onClose from the Done button', async () => {
  const onClose = vi.fn();
  render(<AssetClassManagerDialog open onClose={onClose} assetClasses={[]} isClassInUse={() => false} />);

  await userEvent.click(screen.getByRole('button', { name: 'Done' }));

  expect(onClose).toHaveBeenCalled();
});
