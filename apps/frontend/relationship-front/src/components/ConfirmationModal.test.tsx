import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import ConfirmationModal from './ConfirmationModal';

it('renders default copy', () => {
  render(<ConfirmationModal open onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByText('Confirm Action')).toBeInTheDocument();
  expect(screen.getByText('Are you sure you want to proceed?')).toBeInTheDocument();
});

it('renders custom copy', () => {
  render(
    <ConfirmationModal
      open
      title="Delete entry"
      message="This cannot be undone."
      confirmText="Delete"
      cancelText="Keep it"
      onConfirm={vi.fn()}
      onCancel={vi.fn()}
    />
  );
  expect(screen.getByText('Delete entry')).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
});

it('omits the cancel button when cancelText is empty', () => {
  render(<ConfirmationModal open cancelText="" onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.queryByRole('button', { name: 'Cancel' })).not.toBeInTheDocument();
});

it('invokes onConfirm and onCancel', async () => {
  const onConfirm = vi.fn();
  const onCancel = vi.fn();
  render(<ConfirmationModal open onConfirm={onConfirm} onCancel={onCancel} />);

  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(onConfirm).toHaveBeenCalled();

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onCancel).toHaveBeenCalled();
});

it.each(['error', 'warning', 'info'] as const)('renders the %s severity variant', (severity) => {
  render(<ConfirmationModal open severity={severity} onConfirm={vi.fn()} onCancel={vi.fn()} />);
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
});
