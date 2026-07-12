import { render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { vi } from 'vitest';

vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => 'g1' };
});

const mockedSave = vi.fn();
vi.mock('../hooks/useDashboardSettings', () => ({
  useDashboardSettings: () => ({
    settings: { highlightTypeIds: ['t1'], hiddenTypeIds: ['t2'] },
    types: [
      { _id: 't1', slug: 'reading', name: 'Reading' },
      { _id: 't2', slug: 'gaming', name: 'Gaming' }
    ],
    loading: false,
    save: mockedSave
  })
}));

vi.mock('../components/StatsCards', () => ({ default: () => <div>StatsCards</div> }));
vi.mock('../components/RecentActivitiesCards', () => ({ default: () => <div>RecentActivitiesCards</div> }));
vi.mock('../components/HoursBarChart', () => ({ default: () => <div>HoursBarChart</div> }));
vi.mock('../components/TotalHoursChart', () => ({ default: () => <div>TotalHoursChart</div> }));
vi.mock('../components/TotalDaysChart', () => ({ default: () => <div>TotalDaysChart</div> }));
vi.mock('../components/WeeklyHeatmap', () => ({ default: () => <div>WeeklyHeatmap</div> }));
vi.mock('../components/CumulativeTimeline', () => ({ default: () => <div>CumulativeTimeline</div> }));
vi.mock('../components/DashboardCustomizeDialog', () => ({
  default: ({ open }: { open: boolean }) => (open ? <div>DashboardCustomizeDialog</div> : null)
}));

import Dashboard from './Dashboard';

it('renders the dashboard title and all sub-components', () => {
  render(<Dashboard />);

  expect(screen.getByText('Dashboard')).toBeInTheDocument();
  expect(screen.getByText('StatsCards')).toBeInTheDocument();
  expect(screen.getByText('RecentActivitiesCards')).toBeInTheDocument();
  expect(screen.getByText('HoursBarChart')).toBeInTheDocument();
  expect(screen.getByText('TotalHoursChart')).toBeInTheDocument();
  expect(screen.getByText('TotalDaysChart')).toBeInTheDocument();
  expect(screen.getByText('WeeklyHeatmap')).toBeInTheDocument();
  expect(screen.getByText('CumulativeTimeline')).toBeInTheDocument();
  expect(screen.queryByText('DashboardCustomizeDialog')).not.toBeInTheDocument();
});

it('opens the customize dialog from the Customize button', async () => {
  render(<Dashboard />);
  await userEvent.click(screen.getByRole('button', { name: 'Customize' }));
  expect(screen.getByText('DashboardCustomizeDialog')).toBeInTheDocument();
});
