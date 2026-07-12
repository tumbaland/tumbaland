import { render, screen } from '@testing-library/react';
import GroupStats from './GroupStats';
import { Group } from '../../types';

it('counts total members, admins (including owner), and owners', () => {
  const group: Group = {
    _id: 'g1',
    name: 'Family',
    members: [
      { email: 'a@example.com', role: 'owner' },
      { email: 'b@example.com', role: 'admin' },
      { email: 'c@example.com', role: 'member' }
    ]
  };

  render(<GroupStats group={group} />);

  expect(screen.getByText('3')).toBeInTheDocument(); // total
  expect(screen.getByText('2')).toBeInTheDocument(); // admins (owner + admin)
  expect(screen.getByText('1')).toBeInTheDocument(); // owners
});

it('defaults all counts to 0 when there are no members', () => {
  render(<GroupStats group={{ _id: 'g1', name: 'Empty' }} />);
  expect(screen.getAllByText('0').length).toBe(3);
});
