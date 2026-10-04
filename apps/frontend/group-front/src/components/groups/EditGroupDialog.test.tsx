import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import EditGroupDialog from './EditGroupDialog';

function renderDialog(overrides: Partial<{ name: string; loading: boolean }> = {}) {
  const onClose = vi.fn();
  const onSave = vi.fn();
  const setName = vi.fn();
  render(
    <EditGroupDialog
      open
      onClose={onClose}
      onSave={onSave}
      name={overrides.name ?? 'Family'}
      setName={setName}
      loading={overrides.loading ?? false}
    />
  );
  return { onClose, onSave, setName };
}

it('disables Save Changes when the name is empty', () => {
  renderDialog({ name: '' });
  expect(screen.getByRole('button', { name: 'Save Changes' })).toBeDisabled();
});

it('saves via the button', async () => {
  const { onSave } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Save Changes' }));
  expect(onSave).toHaveBeenCalled();
});

it('shows "Saving..." while loading', () => {
  renderDialog({ loading: true });
  expect(screen.getByRole('button', { name: 'Saving...' })).toBeDisabled();
});

it('updates the name field via setName', async () => {
  const { setName } = renderDialog({ name: '' });
  await userEvent.type(screen.getByLabelText('Group Name'), 'X');
  expect(setName).toHaveBeenCalledWith('X');
});

it('submits on Enter key press', async () => {
  const { onSave } = renderDialog();
  await userEvent.type(screen.getByLabelText('Group Name'), '{Enter}');
  expect(onSave).toHaveBeenCalled();
});

it('calls onClose from the Cancel button', async () => {
  const { onClose } = renderDialog();
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
