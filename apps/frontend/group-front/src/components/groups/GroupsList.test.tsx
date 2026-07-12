import { render, screen } from '@testing-library/react';
import { MemoryRouter } from 'react-router-dom';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';
import GroupsList from './GroupsList';
import { Group } from '../../types';

const groups: Group[] = [
  { _id: 'g1', name: 'Family' },
  { _id: 'g2', name: 'Work' }
];

function renderList(list: Group[] = groups) {
  const onMenuOpen = vi.fn();
  const onCreateClick = vi.fn();
  render(
    <MemoryRouter>
      <GroupsList
        groups={list}
        canModifyGroup={() => true}
        getUserRole={() => 'owner'}
        onMenuOpen={onMenuOpen}
        onCreateClick={onCreateClick}
      />
    </MemoryRouter>
  );
  return { onMenuOpen, onCreateClick };
}

it('shows an empty state with a create button when there are no groups', async () => {
  const { onCreateClick } = renderList([]);
  expect(screen.getByText('No Groups Yet')).toBeInTheDocument();

  await userEvent.click(screen.getByRole('button', { name: /create your first group/i }));
  expect(onCreateClick).toHaveBeenCalled();
});

it('renders a card per group', () => {
  renderList();
  expect(screen.getByText('Family')).toBeInTheDocument();
  expect(screen.getByText('Work')).toBeInTheDocument();
});
