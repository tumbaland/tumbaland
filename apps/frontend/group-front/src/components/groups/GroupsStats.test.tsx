import { render, screen } from '@testing-library/react';
import GroupsStats from './GroupsStats';
import { Group } from '../../types';

it('renders nothing when there are no groups', () => {
  const { container } = render(<GroupsStats groups={[]} getUserRole={() => 'member'} />);
  expect(container).toBeEmptyDOMElement();
});

it('sums total groups, members (defaulting missing members to 1), and owned groups', () => {
  const groups: Group[] = [
    { _id: 'g1', name: 'Family', members: [{ email: 'a@example.com', role: 'owner' }, { email: 'b@example.com', role: 'member' }] },
    { _id: 'g2', name: 'Solo' } // no members array -> counts as 1
  ];

  render(<GroupsStats groups={groups} getUserRole={(g) => (g._id === 'g1' ? 'owner' : 'member')} />);

  expect(screen.getByText('2')).toBeInTheDocument(); // total groups
  expect(screen.getByText('3')).toBeInTheDocument(); // total members (2 + 1)
  expect(screen.getByText('1')).toBeInTheDocument(); // owned groups
});
