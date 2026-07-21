import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import ConfirmDialog from './ConfirmDialog';

function baseProps(overrides: Partial<React.ComponentProps<typeof ConfirmDialog>> = {}) {
  return {
    open: true,
    onClose: vi.fn(),
    onConfirm: vi.fn(),
    title: 'Delete photo',
    message: 'This cannot be undone.',
    ...overrides
  };
}

it('renders nothing when closed', () => {
  render(<ConfirmDialog {...baseProps({ open: false })} />);
  expect(screen.queryByText('Delete photo')).not.toBeInTheDocument();
});

it('shows the title and message', () => {
  render(<ConfirmDialog {...baseProps()} />);
  expect(screen.getByText('Delete photo')).toBeInTheDocument();
  expect(screen.getByText('This cannot be undone.')).toBeInTheDocument();
});

it('defaults the button labels to Confirm/Cancel', () => {
  render(<ConfirmDialog {...baseProps()} />);
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Confirm' })).toBeInTheDocument();
});

it('uses custom button labels when provided', () => {
  render(<ConfirmDialog {...baseProps({ confirmText: 'Delete', cancelText: 'Keep it' })} />);
  expect(screen.getByRole('button', { name: 'Keep it' })).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Delete' })).toBeInTheDocument();
});

it('calls onConfirm and onClose from their respective buttons', async () => {
  const onClose = vi.fn();
  const onConfirm = vi.fn();
  render(<ConfirmDialog {...baseProps({ onClose, onConfirm })} />);

  await userEvent.click(screen.getByRole('button', { name: 'Confirm' }));
  expect(onConfirm).toHaveBeenCalledTimes(1);

  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalledTimes(1);
});

it('closes via the X button too', async () => {
  const onClose = vi.fn();
  render(<ConfirmDialog {...baseProps({ onClose })} />);

  // The close (X) icon button has no accessible name.
  const buttons = screen.getAllByRole('button');
  const closeButton = buttons.find((b) => !b.textContent);
  await userEvent.click(closeButton!);

  expect(onClose).toHaveBeenCalledTimes(1);
});

it('disables all buttons and shows "Processing..." while loading', () => {
  render(<ConfirmDialog {...baseProps({ loading: true })} />);

  expect(screen.getByRole('button', { name: 'Processing...' })).toBeDisabled();
  expect(screen.getByRole('button', { name: 'Cancel' })).toBeDisabled();
});
