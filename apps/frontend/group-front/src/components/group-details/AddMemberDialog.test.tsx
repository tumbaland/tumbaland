import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import AddMemberDialog from './AddMemberDialog';

it('does not submit when the email is empty', async () => {
  const onAdd = vi.fn();
  render(<AddMemberDialog open onClose={vi.fn()} onAdd={onAdd} />);

  await userEvent.click(screen.getByRole('button', { name: 'Add Member' }));

  expect(onAdd).not.toHaveBeenCalled();
});

it('adds a member, clears the field, and closes on success', async () => {
  const onAdd = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<AddMemberDialog open onClose={onClose} onAdd={onAdd} />);

  const emailInput = screen.getByLabelText(/^Email Address/) as HTMLInputElement;
  await userEvent.type(emailInput, 'a@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Add Member' }));

  expect(onAdd).toHaveBeenCalledWith('a@example.com');
  await screen.findByRole('button', { name: 'Add Member' }); // wait for loading state to resolve
  expect(onClose).toHaveBeenCalled();
});

it('shows an error message and re-enables the form when onAdd fails', async () => {
  const onAdd = vi.fn().mockRejectedValue(new Error('fail'));
  render(<AddMemberDialog open onClose={vi.fn()} onAdd={onAdd} />);

  await userEvent.type(screen.getByLabelText(/^Email Address/), 'a@example.com');
  await userEvent.click(screen.getByRole('button', { name: 'Add Member' }));

  expect(await screen.findByText(/failed to add member/i)).toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Add Member' })).toBeEnabled();
});

it('calls onClose from the Cancel button', async () => {
  const onClose = vi.fn();
  render(<AddMemberDialog open onClose={onClose} onAdd={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
