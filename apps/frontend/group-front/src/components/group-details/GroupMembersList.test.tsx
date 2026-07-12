import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GroupMembersList from './GroupMembersList';
import { Group } from '../../types';

const group: Group = {
  _id: 'g1',
  name: 'Family',
  members: [
    { email: 'owner@example.com', role: 'owner', joinedAt: '2024-01-15T00:00:00.000Z' },
    { email: 'admin@example.com', role: 'admin' },
    { email: 'member@example.com', role: 'member' }
  ]
};

function renderList(overrides: Partial<{ group: Group; currentUserRole: string; currentUserEmail: string }> = {}) {
  const onAddMember = vi.fn();
  const onMenuOpen = vi.fn();
  const result = render(
    <GroupMembersList
      group={overrides.group ?? group}
      currentUserRole={overrides.currentUserRole}
      currentUserEmail={overrides.currentUserEmail}
      onAddMember={onAddMember}
      onMenuOpen={onMenuOpen}
    />
  );
  return { onAddMember, onMenuOpen, ...result };
}

it('shows the empty state when there are no members', () => {
  renderList({ group: { _id: 'g2', name: 'Empty' } });
  expect(screen.getByText('No members found in this group')).toBeInTheDocument();
});

it('renders a row per member with name derived from email, role chip, and formatted join date', () => {
  renderList({ currentUserRole: 'owner', currentUserEmail: 'owner@example.com' });

  expect(screen.getAllByText('owner').length).toBeGreaterThan(0); // derived name + role chip
  expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  expect(screen.getByText('1/15/2024')).toBeInTheDocument();
  expect(screen.getAllByText('-').length).toBe(2); // admin/member have no joinedAt
});

it('shows Add Member for an owner/admin and hides it for a plain member', () => {
  const { rerender } = renderList({ currentUserRole: 'owner' });
  expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument();

  rerender(
    <GroupMembersList group={group} currentUserRole="member" onAddMember={vi.fn()} onMenuOpen={vi.fn()} />
  );
  expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
});

it('calls onAddMember', async () => {
  const { onAddMember } = renderList({ currentUserRole: 'owner' });
  await userEvent.click(screen.getByRole('button', { name: /add member/i }));
  expect(onAddMember).toHaveBeenCalled();
});

it('shows the member menu for an owner acting on a plain member, but not on themself or the owner row', async () => {
  const { onMenuOpen } = renderList({ currentUserRole: 'owner', currentUserEmail: 'owner@example.com' });

  // 3 members, only "member@example.com" and "admin@example.com" are editable by the owner
  // (owner row is unmanageable, and the owner viewing themself is excluded).
  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  expect(menuButtons.length).toBe(2);

  await userEvent.click(menuButtons[0]);
  expect(onMenuOpen).toHaveBeenCalled();
});

it('prevents an admin from managing another admin', () => {
  renderList({ currentUserRole: 'admin', currentUserEmail: 'admin@example.com' });
  // admin can only manage the plain member row -> 1 menu button
  const menuButtons = screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));
  expect(menuButtons.length).toBe(1);
});

it('hides all member menus for a plain member viewer', () => {
  renderList({ currentUserRole: 'member', currentUserEmail: 'member@example.com' });
  expect(screen.queryAllByTestId('MoreVertIcon').length).toBe(0);
});
