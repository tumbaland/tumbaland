import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vite-plus/test';
import GroupMembersList, { formatDateTime, formatDay, nameFromEmail } from './GroupMembersList';
import { Group } from '../../types';

const group: Group = {
  _id: 'g1',
  name: 'Family',
  members: [
    {
      email: 'owner@example.com',
      role: 'owner',
      joinedAt: '2024-01-15T12:00:00.000Z',
      lastActivity: '2024-01-20T12:30:45.000Z'
    },
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

const menuButtons = () => screen.getAllByRole('button').filter((b) => b.querySelector('[data-testid="MoreVertIcon"]'));

it('shows the empty state when there are no members', () => {
  renderList({ group: { _id: 'g2', name: 'Empty' } });
  expect(screen.getByText('No members yet')).toBeInTheDocument();
});

it('renders a row per member with a readable name, the address and a role badge', () => {
  renderList({ currentUserRole: 'owner', currentUserEmail: 'owner@example.com' });

  expect(screen.getAllByRole('listitem')).toHaveLength(3);
  expect(screen.getByText('Admin')).toBeInTheDocument(); // name read from admin@example.com
  expect(screen.getByText('admin@example.com')).toBeInTheDocument();
  expect(screen.getByText('owner')).toBeInTheDocument(); // role badge
});

it('shows the day a member joined and the date and time they were last active', () => {
  renderList({ currentUserRole: 'owner', currentUserEmail: 'owner@example.com' });

  expect(screen.getByText(`Joined ${formatDay('2024-01-15T12:00:00.000Z')}`)).toBeInTheDocument();
  expect(screen.getByText(`Active ${formatDateTime('2024-01-20T12:30:45.000Z')}`)).toBeInTheDocument();
  // Minutes are enough; seconds were noise.
  expect(screen.queryByText(/\d:\d\d:\d\d/)).not.toBeInTheDocument();
});

it('formats dates the Estonian way, with a 24-hour time for activity', () => {
  // No zone suffix, so these parse as local time and the expectation holds anywhere.
  expect(formatDay('2025-03-02T09:14:00')).toBe('02.03.2025');
  expect(formatDateTime('2026-09-13T21:22:10')).toBe('13.09.2026 21:22');
  expect(formatDateTime('2026-01-05T07:05:00')).toBe('05.01.2026 07:05');
  expect(formatDay(undefined)).toBeNull();
  expect(formatDateTime(undefined)).toBeNull();
});

it('leaves the activity line out for a member with no dates', () => {
  renderList({ group: { _id: 'g3', name: 'Solo', members: [{ email: 'a@example.com', role: 'member' }] } });
  expect(screen.queryByText(/Joined|Active/)).not.toBeInTheDocument();
});

it('tags the viewer as You', () => {
  renderList({ currentUserRole: 'owner', currentUserEmail: 'owner@example.com' });
  expect(screen.getByText('You')).toBeInTheDocument();
});

it('shows Add member for an owner/admin and hides it for a plain member', () => {
  const { rerender } = renderList({ currentUserRole: 'owner' });
  expect(screen.getByRole('button', { name: /add member/i })).toBeInTheDocument();

  rerender(<GroupMembersList group={group} currentUserRole="member" onAddMember={vi.fn()} onMenuOpen={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /add member/i })).not.toBeInTheDocument();
});

it('calls onAddMember', async () => {
  const { onAddMember } = renderList({ currentUserRole: 'owner' });
  await userEvent.click(screen.getByRole('button', { name: /add member/i }));
  expect(onAddMember).toHaveBeenCalled();
});

it('shows the member menu for an owner acting on others, but not on themself or the owner row', async () => {
  const { onMenuOpen } = renderList({ currentUserRole: 'owner', currentUserEmail: 'owner@example.com' });

  // Only admin@ and member@ are editable by the owner.
  expect(menuButtons()).toHaveLength(2);
  expect(screen.getByRole('button', { name: 'Options for member@example.com' })).toBeInTheDocument();

  await userEvent.click(menuButtons()[0]);
  expect(onMenuOpen).toHaveBeenCalled();
});

it('prevents an admin from managing another admin', () => {
  renderList({ currentUserRole: 'admin', currentUserEmail: 'admin@example.com' });
  expect(menuButtons()).toHaveLength(1);
});

it('hides all member menus for a plain member viewer', () => {
  renderList({ currentUserRole: 'member', currentUserEmail: 'member@example.com' });
  expect(screen.queryAllByTestId('MoreVertIcon')).toHaveLength(0);
});

it('reads a name out of an address', () => {
  expect(nameFromEmail('test.user@example.com')).toBe('Test User');
  expect(nameFromEmail('partner@example.com')).toBe('Partner');
  expect(nameFromEmail('first_last+tag@example.com')).toBe('First Last Tag');
});
