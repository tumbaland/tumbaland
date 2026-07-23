import { render, screen } from '@testing-library/react';
import TagsChart from './TagsChart';

it('shows the empty state when there are no tags', () => {
  render(<TagsChart tags={[]} />);

  expect(screen.getByText('No tags found')).toBeInTheDocument();
});

it('renders the section title when tags are present', () => {
  render(
    <TagsChart
      tags={[
        { tag: 'vacation', count: 12 },
        { tag: 'family', count: 8 }
      ]}
    />
  );

  expect(screen.getByText('Popular Tags')).toBeInTheDocument();
  expect(screen.queryByText('No tags found')).not.toBeInTheDocument();
});
