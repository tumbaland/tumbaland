import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import DeleteGroupDialog from './DeleteGroupDialog';
import { Group } from '../../types';

const group: Group = { _id: 'g1', name: 'Family' };

function renderDialog(overrides: Partial<{ group: Group | null; loading: boolean }> = {}) {
  const onClose = vi.fn();
  const onDelete = vi.fn();
  render(
    <DeleteGroupDialog
      open
      onClose={onClose}
      onDelete={onDelete}
      group={overrides.group === undefined ? group : overrides.group}
      loading={overrides.loading ?? false}
    />
  );
  return { onClose, onDelete };
}

it('shows the group name in the confirmation message', () => {
  renderDialog();
  expect(screen.getByText(/"Family"/)).toBeInTheDocument();
});

it('handles a null group without throwing', () => {
  renderDialog({ group: null });
  expect(screen.getAllByText('Delete Group').length).toBeGreaterThan(0);
});

it('calls onDelete from the Delete Group button', async () => {
  const { onDelete } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Delete Group' }));
  expect(onDelete).toHaveBeenCalled();
});

it('shows "Deleting..." and disables the button while loading', () => {
  renderDialog({ loading: true });
  expect(screen.getByRole('button', { name: 'Deleting...' })).toBeDisabled();
});

it('calls onClose from the Cancel button', async () => {
  const { onClose } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
