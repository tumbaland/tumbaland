import { render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { MemoryRouter } from 'react-router';
import { QueryClient, QueryClientProvider } from '@tanstack/react-query';
import { vi } from 'vitest';

const mockUseTenantFilter = vi.fn();
vi.mock('@tumbaland/components', async (importOriginal) => {
  const actual = await importOriginal<typeof import('@tumbaland/components')>();
  return { ...actual, useTenantFilter: () => mockUseTenantFilter() };
});

vi.mock('../hooks/useStatistics', () => ({ useStatistics: vi.fn() }));
vi.mock('../services/groupService', () => ({ getUserGroups: vi.fn() }));
vi.mock('../services/entitlementsService', () => ({ getMyEntitlements: vi.fn() }));

import { useStatistics } from '../hooks/useStatistics';
import { getUserGroups } from '../services/groupService';
import { getMyEntitlements } from '../services/entitlementsService';
import DashboardPage from './DashboardPage';

const mockedUseStatistics = useStatistics as unknown as ReturnType<typeof vi.fn>;
const mockedGetUserGroups = getUserGroups as unknown as ReturnType<typeof vi.fn>;
const mockedGetMyEntitlements = getMyEntitlements as unknown as ReturnType<typeof vi.fn>;

const entitlements = {
  email: 'user@example.com',
  planCode: 'free',
  status: null,
  limits: {
    meters: { storageBytes: 1024 * 1024 * 1024, aiJobs: 25, trackedTickers: 3, seats: 1 },
    features: { cleanExport: false },
    retentionDays: 90
  },
  usage: { storageBytes: 1024, aiJobs: 0, trackedTickers: 0, seats: 1 }
};

const statistics = {
  overview: { totalAlbums: 3, totalPhotos: 100, totalStorage: 1024, averagePhotoSize: 100 },
  timeSeries: { albumsCreated: [], photosUploaded: [] },
  tags: [],
  groups: [],
  albums: [{ albumId: 'a1', name: 'Trip', totalSize: 512, photoCount: 3 }]
};

function renderPage() {
  const queryClient = new QueryClient({ defaultOptions: { queries: { retry: false } } });
  return render(
    <MemoryRouter>
      <QueryClientProvider client={queryClient}>
        <DashboardPage />
      </QueryClientProvider>
    </MemoryRouter>
  );
}

beforeEach(() => {
  vi.clearAllMocks();
  mockUseTenantFilter.mockReturnValue(undefined);
  mockedGetUserGroups.mockResolvedValue([]);
  mockedGetMyEntitlements.mockResolvedValue(entitlements);
});

it('shows a progress bar (not the charts) while loading', () => {
  mockedUseStatistics.mockReturnValue({ statistics: null, loading: true, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByRole('progressbar')).toBeInTheDocument();
  expect(screen.queryByText('Total Albums')).not.toBeInTheDocument();
});

it('shows a retryable error when there is an error and no cached statistics', async () => {
  const refetch = vi.fn();
  mockedUseStatistics.mockReturnValue({ statistics: null, loading: false, isFetching: false, error: 'network down', refetch });

  renderPage();

  expect(screen.getByText('network down')).toBeInTheDocument();
  await userEvent.click(screen.getByRole('button', { name: /retry/i }));
  expect(refetch).toHaveBeenCalledTimes(1);
});

it('shows an info message when there is no statistics data and no error', () => {
  mockedUseStatistics.mockReturnValue({ statistics: null, loading: false, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByText('No statistics data available')).toBeInTheDocument();
});

it('renders the overview and charts once statistics are available', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByText('Total Albums')).toBeInTheDocument();
  expect(screen.getByText('Activity Over Time')).toBeInTheDocument();
  expect(screen.getByText('Storage Usage')).toBeInTheDocument();
});

it('passes the per-album storage breakdown through to the storage chart', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByText('Largest albums')).toBeInTheDocument();
  expect(screen.getByText('Trip')).toBeInTheDocument();
  expect(screen.getByText('512 B')).toBeInTheDocument();
});

it('leaves navigation to the section tabs rather than repeating it as header buttons', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch: vi.fn() });
  renderPage();

  expect(screen.queryByRole('button', { name: /view albums/i })).not.toBeInTheDocument();
  expect(screen.queryByRole('button', { name: /view collages/i })).not.toBeInTheDocument();
  expect(screen.getByRole('heading', { level: 1, name: 'Dashboard' })).toBeInTheDocument();
});

it('calls refetch when the refresh button is clicked', async () => {
  const refetch = vi.fn();
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: false, error: null, refetch });

  renderPage();

  await userEvent.click(screen.getByRole('button', { name: /refresh statistics/i }));

  expect(refetch).toHaveBeenCalledTimes(1);
});

it('shows a non-blocking progress indicator and disables refresh while refetching', () => {
  mockedUseStatistics.mockReturnValue({ statistics, loading: false, isFetching: true, error: null, refetch: vi.fn() });

  renderPage();

  expect(screen.getByRole('button', { name: /refresh statistics/i })).toBeDisabled();
  expect(screen.getAllByRole('progressbar').length).toBeGreaterThan(0);
});

it('resolves group ids to names for the distribution chart', async () => {
  mockedUseStatistics.mockReturnValue({
    statistics: { ...statistics, groups: [{ groupId: 'g1', albumCount: 1, photoCount: 5 }] },
    loading: false,
    isFetching: false,
    error: null,
    refetch: vi.fn()
  });
  mockedGetUserGroups.mockResolvedValue([{ _id: 'g1', name: 'Family' }]);

  renderPage();

  await waitFor(() => expect(screen.getAllByText('Family').length).toBeGreaterThan(0));
});
