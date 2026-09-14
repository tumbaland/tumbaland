import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GroupDetailsHeader from './GroupDetailsHeader';

it('shows the group name and calls onBack', async () => {
  const onBack = vi.fn();
  render(<GroupDetailsHeader groupName="Family" onBack={onBack} onEdit={vi.fn()} currentUserRole="member" />);

  expect(screen.getByRole('heading', { name: 'Family' })).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /back to groups/i }));
  expect(onBack).toHaveBeenCalled();
});

it.each(['owner', 'admin'])('shows the Rename button for %s', (role) => {
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={vi.fn()} currentUserRole={role} />);
  expect(screen.getByRole('button', { name: /rename/i })).toBeInTheDocument();
});

it('hides the Rename button for a plain member', () => {
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={vi.fn()} currentUserRole="member" />);
  expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument();
});

it('hides the Rename button when currentUserRole is undefined', () => {
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /rename/i })).not.toBeInTheDocument();
});

it('calls onEdit', async () => {
  const onEdit = vi.fn();
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={onEdit} currentUserRole="owner" />);
  await userEvent.click(screen.getByRole('button', { name: /rename/i }));
  expect(onEdit).toHaveBeenCalled();
});

it('says how many members there are and what the viewer is', () => {
  render(
    <GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={vi.fn()} currentUserRole="owner" memberCount={4} />
  );
  expect(screen.getByText("4 members · You're the owner")).toBeInTheDocument();
});

it('uses the singular for one member and marks the group with its initials', () => {
  render(
    <GroupDetailsHeader groupName="Book club" onBack={vi.fn()} onEdit={vi.fn()} currentUserRole="member" memberCount={1} />
  );
  expect(screen.getByText("1 member · You're a member")).toBeInTheDocument();
  expect(screen.getByText('BC')).toBeInTheDocument();
});
