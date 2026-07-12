import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GroupDetailsHeader from './GroupDetailsHeader';

it('shows the group name and calls onBack', async () => {
  const onBack = vi.fn();
  render(<GroupDetailsHeader groupName="Family" onBack={onBack} onEdit={vi.fn()} currentUserRole="member" />);

  expect(screen.getByText('Family')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /back to groups/i }));
  expect(onBack).toHaveBeenCalled();
});

it.each(['owner', 'admin'])('shows the Edit Group button for %s', (role) => {
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={vi.fn()} currentUserRole={role} />);
  expect(screen.getByRole('button', { name: /edit group/i })).toBeInTheDocument();
});

it('hides the Edit Group button for a plain member', () => {
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={vi.fn()} currentUserRole="member" />);
  expect(screen.queryByRole('button', { name: /edit group/i })).not.toBeInTheDocument();
});

it('hides the Edit Group button when currentUserRole is undefined', () => {
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={vi.fn()} />);
  expect(screen.queryByRole('button', { name: /edit group/i })).not.toBeInTheDocument();
});

it('calls onEdit', async () => {
  const onEdit = vi.fn();
  render(<GroupDetailsHeader groupName="Family" onBack={vi.fn()} onEdit={onEdit} currentUserRole="owner" />);
  await userEvent.click(screen.getByRole('button', { name: /edit group/i }));
  expect(onEdit).toHaveBeenCalled();
});
