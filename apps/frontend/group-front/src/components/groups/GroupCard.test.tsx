import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GroupCard from './GroupCard';
import { Group } from '../../types';

const group: Group = { _id: 'g1', name: 'Family', members: [{ email: 'a@example.com', role: 'owner' }, { email: 'b@example.com', role: 'member' }] };

function renderCard(overrides: Partial<{ group: Group; canModify: boolean; userRole: string }> = {}) {
  const onMenuOpen = vi.fn();
  render(
    <MemoryRouter>
      <GroupCard
        group={overrides.group ?? group}
        canModify={overrides.canModify ?? true}
        userRole={overrides.userRole ?? 'owner'}
        onMenuOpen={onMenuOpen}
      />
    </MemoryRouter>
  );
  return { onMenuOpen };
}

it('links to the group detail page', () => {
  renderCard();
  expect(screen.getByRole('link')).toHaveAttribute('href', '/g1');
});

it('shows the plural member count', () => {
  renderCard();
  expect(screen.getByText('2 members')).toBeInTheDocument();
});

it('shows a singular member count and defaults to 1 when members is undefined', () => {
  renderCard({ group: { _id: 'g2', name: 'Solo' } });
  expect(screen.getByText('1 member')).toBeInTheDocument();
});

it('shows the owner chip with primary color', () => {
  renderCard({ userRole: 'owner' });
  expect(screen.getByText('owner')).toBeInTheDocument();
});

it('shows a non-owner role chip', () => {
  renderCard({ userRole: 'member' });
  expect(screen.getByText('member')).toBeInTheDocument();
});

it('shows the menu button and calls onMenuOpen when modifiable', async () => {
  const { onMenuOpen } = renderCard({ canModify: true });
  const menuButton = screen.getAllByRole('button').find((b) => b.querySelector('[data-testid="MoreVertIcon"]'))!;
  await userEvent.click(menuButton);
  expect(onMenuOpen).toHaveBeenCalledWith(expect.anything(), group);
});

it('hides the menu button when not modifiable, keeping the Open Group button', () => {
  renderCard({ canModify: false });
  expect(screen.queryByTestId('MoreVertIcon')).not.toBeInTheDocument();
  expect(screen.getByRole('button', { name: 'Open Group' })).toBeInTheDocument();
});
