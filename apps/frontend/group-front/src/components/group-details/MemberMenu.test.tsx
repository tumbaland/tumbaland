import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import MemberMenu from './MemberMenu';
import { GroupMember } from '../../types';

const member: GroupMember = { email: 'a@example.com', role: 'member' };

function renderMenu(overrides: Partial<{ selectedMember: GroupMember | null; currentUserRole: string }> = {}) {
  const onClose = vi.fn();
  const onChangeRole = vi.fn();
  const onRemoveMember = vi.fn();
  const result = render(
    <MemberMenu
      anchorEl={document.body}
      open
      onClose={onClose}
      selectedMember={overrides.selectedMember === undefined ? member : overrides.selectedMember}
      currentUserRole={overrides.currentUserRole}
      onChangeRole={onChangeRole}
      onRemoveMember={onRemoveMember}
    />
  );
  return { onClose, onChangeRole, onRemoveMember, ...result };
}

it('renders nothing when there is no selected member', () => {
  const { container } = renderMenu({ selectedMember: null });
  expect(container).toBeEmptyDOMElement();
});

it('shows both actions for an owner managing a plain member', () => {
  renderMenu({ currentUserRole: 'owner' });
  expect(screen.getByText('Change Role')).toBeInTheDocument();
  expect(screen.getByText('Remove from Group')).toBeInTheDocument();
});

it('hides both actions when the selected member is the owner', () => {
  renderMenu({ currentUserRole: 'owner', selectedMember: { email: 'o@example.com', role: 'owner' } });
  expect(screen.queryByText('Change Role')).not.toBeInTheDocument();
  expect(screen.queryByText('Remove from Group')).not.toBeInTheDocument();
});

it('hides both actions for a plain member viewer', () => {
  renderMenu({ currentUserRole: 'member' });
  expect(screen.queryByText('Change Role')).not.toBeInTheDocument();
  expect(screen.queryByText('Remove from Group')).not.toBeInTheDocument();
});

it('calls onChangeRole and onClose when Change Role is clicked', async () => {
  const { onChangeRole, onClose } = renderMenu({ currentUserRole: 'owner' });
  await userEvent.click(screen.getByText('Change Role'));
  expect(onChangeRole).toHaveBeenCalled();
  expect(onClose).toHaveBeenCalled();
});

it('calls onRemoveMember with the email and onClose when Remove is clicked', async () => {
  const { onRemoveMember, onClose } = renderMenu({ currentUserRole: 'owner' });
  await userEvent.click(screen.getByText('Remove from Group'));
  expect(onRemoveMember).toHaveBeenCalledWith('a@example.com');
  expect(onClose).toHaveBeenCalled();
});

it('allows an admin to manage a plain member', () => {
  renderMenu({ currentUserRole: 'admin' });
  expect(screen.getByText('Change Role')).toBeInTheDocument();
  expect(screen.getByText('Remove from Group')).toBeInTheDocument();
});
