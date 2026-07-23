import { render, screen } from '@testing-library/react';
import GroupDistributionChart from './GroupDistributionChart';

it('shows the empty state when there are no groups', () => {
  render(<GroupDistributionChart groups={[]} />);

  expect(screen.getByText('No group data available')).toBeInTheDocument();
});

it('renders a legend row per group with resolved names and photo counts', () => {
  render(
    <GroupDistributionChart
      groups={[
        { groupId: 'personal', albumCount: 2, photoCount: 10 },
        { groupId: 'g1', albumCount: 1, photoCount: 5 },
        { groupId: 'g2', albumCount: 3, photoCount: 20 }
      ]}
      groupNames={{ g1: 'Family' }}
    />
  );

  // The chart itself also renders each label as an arc label, so these
  // labels appear more than once (legend row + pie slice) — use getAllByText.
  expect(screen.getAllByText('Personal').length).toBeGreaterThan(0);
  expect(screen.getByText('10 photos')).toBeInTheDocument();
  expect(screen.getAllByText('Family').length).toBeGreaterThan(0);
  expect(screen.getByText('5 photos')).toBeInTheDocument();
  // g2 has no entry in groupNames, so it falls back to a "Group <id-suffix>" label.
  expect(screen.getAllByText('Group g2').length).toBeGreaterThan(0);
  expect(screen.getByText('20 photos')).toBeInTheDocument();
});
