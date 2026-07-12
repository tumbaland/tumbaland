import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import CreateGroupDialog from './CreateGroupDialog';

function renderDialog(overrides: Partial<{ name: string; loading: boolean }> = {}) {
  const onClose = vi.fn();
  const onCreate = vi.fn();
  const setName = vi.fn();
  render(
    <CreateGroupDialog
      open
      onClose={onClose}
      onCreate={onCreate}
      name={overrides.name ?? ''}
      setName={setName}
      loading={overrides.loading ?? false}
    />
  );
  return { onClose, onCreate, setName };
}

it('disables Create Group when the name is empty', () => {
  renderDialog({ name: '' });
  expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
});

it('disables Create Group when the name is only whitespace', () => {
  renderDialog({ name: '   ' });
  expect(screen.getByRole('button', { name: 'Create Group' })).toBeDisabled();
});

it('enables Create Group with a non-empty name and calls onCreate', async () => {
  const { onCreate } = renderDialog({ name: 'Family' });
  const button = screen.getByRole('button', { name: 'Create Group' });
  expect(button).toBeEnabled();
  await userEvent.click(button);
  expect(onCreate).toHaveBeenCalled();
});

it('shows "Creating..." and disables the button while loading', () => {
  renderDialog({ name: 'Family', loading: true });
  expect(screen.getByRole('button', { name: 'Creating...' })).toBeDisabled();
});

it('updates the name field via setName', async () => {
  const { setName } = renderDialog({ name: '' });
  await userEvent.type(screen.getByLabelText('Group Name'), 'X');
  expect(setName).toHaveBeenCalledWith('X');
});

it('submits on Enter key press', async () => {
  const { onCreate } = renderDialog({ name: 'Family' });
  await userEvent.type(screen.getByLabelText('Group Name'), '{Enter}');
  expect(onCreate).toHaveBeenCalled();
});

it('calls onClose from the Cancel button', async () => {
  const { onClose } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
