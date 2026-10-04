import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import ChangeRoleDialog from './ChangeRoleDialog';
import { GroupMember } from '../../types';

it('renders nothing when there is no member', () => {
  const { container } = render(<ChangeRoleDialog open onClose={vi.fn()} member={null} onSave={vi.fn()} />);
  expect(container).toBeEmptyDOMElement();
});

it("preselects the member's current role", () => {
  const member: GroupMember = { email: 'a@example.com', role: 'admin' };
  render(<ChangeRoleDialog open onClose={vi.fn()} member={member} onSave={vi.fn()} />);
  expect(screen.getByRole('radio', { name: 'Admin' })).toBeChecked();
});

it('defaults to "member" when the member has some other role (e.g. owner)', () => {
  const member: GroupMember = { email: 'a@example.com', role: 'owner' };
  render(<ChangeRoleDialog open onClose={vi.fn()} member={member} onSave={vi.fn()} />);
  expect(screen.getByRole('radio', { name: 'Member' })).toBeChecked();
});

it('saves the newly selected role and closes on success', async () => {
  const member: GroupMember = { email: 'a@example.com', role: 'member' };
  const onSave = vi.fn().mockResolvedValue(undefined);
  const onClose = vi.fn();
  render(<ChangeRoleDialog open onClose={onClose} member={member} onSave={onSave} />);

  await userEvent.click(screen.getByRole('radio', { name: 'Admin' }));
  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  expect(onSave).toHaveBeenCalledWith('a@example.com', 'admin');
  await screen.findByRole('button', { name: 'Save' });
  expect(onClose).toHaveBeenCalled();
});

it('logs and does not close when onSave fails', async () => {
  const member: GroupMember = { email: 'a@example.com', role: 'member' };
  const onSave = vi.fn().mockRejectedValue(new Error('fail'));
  const onClose = vi.fn();
  render(<ChangeRoleDialog open onClose={onClose} member={member} onSave={onSave} />);

  await userEvent.click(screen.getByRole('button', { name: 'Save' }));

  await vi.waitFor(() => expect(onSave).toHaveBeenCalled());
  expect(onClose).not.toHaveBeenCalled();
});

it('calls onClose from the Cancel button', async () => {
  const member: GroupMember = { email: 'a@example.com', role: 'member' };
  const onClose = vi.fn();
  render(<ChangeRoleDialog open onClose={onClose} member={member} onSave={vi.fn()} />);
  await userEvent.click(screen.getByRole('button', { name: 'Cancel' }));
  expect(onClose).toHaveBeenCalled();
});
